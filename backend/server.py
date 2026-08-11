from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import (
    LlmChat,
    UserMessage,
    ImageContent,
    TextDelta,
    StreamDone,
)
try:
    from emergentintegrations.llm.gemeni.image_generation import GeminiImageGeneration
except Exception:
    GeminiImageGeneration = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
JWT_SECRET = os.environ["JWT_SECRET"]  # required — fail fast if missing
JWT_ALGO = "HS256"
JWT_EXPIRY_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="INSIDE OUT API")
api = APIRouter(prefix="/api")

# ---------- Models ----------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    experience_level: str = "Beginner"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class AnalyzeIn(BaseModel):
    image_base64: str
    experience_level: Optional[str] = "Beginner"
    project_id: Optional[str] = None
    model: Optional[str] = None

class ChatIn(BaseModel):
    project_id: str
    message: str
    model: Optional[str] = None

class DiagramIn(BaseModel):
    project_id: str
    kind: str = "exploded"

class PreferencesIn(BaseModel):
    preferred_model: Optional[str] = None
    experience_level: Optional[str] = None

# ---------- Claude model registry ----------
CLAUDE_MODELS = {
    "claude-sonnet-5":            {"label": "Sonnet 5",    "tier": "flagship", "desc": "Newest & most capable"},
    "claude-sonnet-4-6":          {"label": "Sonnet 4.6",  "tier": "balanced", "desc": "Balanced default"},
    "claude-haiku-4-5-20251001":  {"label": "Haiku 4.5",   "tier": "fast",     "desc": "Fastest & lowest cost"},
    "claude-opus-4-7":            {"label": "Opus 4.7",    "tier": "deep",     "desc": "Deepest reasoning"},
}
DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6"

def resolve_model(requested: Optional[str], user: Optional[dict] = None) -> str:
    if requested and requested in CLAUDE_MODELS:
        return requested
    if user and user.get("preferred_model") in CLAUDE_MODELS:
        return user["preferred_model"]
    return DEFAULT_CLAUDE_MODEL

# ---------- Auth helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def _user_public(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "experience_level": user.get("experience_level", "Beginner"),
        "xp": user.get("xp", 0),
        "projects_count": user.get("projects_count", 0),
        "preferred_model": user.get("preferred_model", DEFAULT_CLAUDE_MODEL),
    }

@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "name": body.name, "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "experience_level": body.experience_level,
        "xp": 0, "projects_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return {"token": make_token(uid), "user": _user_public(doc)}

@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return {"token": make_token(user["id"]), "user": _user_public(user)}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": user}

@api.delete("/auth/account")
async def delete_account(user=Depends(get_current_user)):
    # Cascade delete everything belonging to this user
    await db.chats.delete_many({"user_id": user["id"]})
    await db.projects.delete_many({"user_id": user["id"]})
    await db.users.delete_one({"id": user["id"]})
    return {"ok": True}

@api.get("/models")
async def list_models():
    return {
        "default": DEFAULT_CLAUDE_MODEL,
        "models": [
            {"id": mid, **meta} for mid, meta in CLAUDE_MODELS.items()
        ],
    }

@api.patch("/auth/preferences")
async def update_preferences(body: PreferencesIn, user=Depends(get_current_user)):
    update = {}
    if body.preferred_model is not None:
        if body.preferred_model not in CLAUDE_MODELS:
            raise HTTPException(400, "Invalid model")
        update["preferred_model"] = body.preferred_model
    if body.experience_level is not None:
        update["experience_level"] = body.experience_level
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {"user": _user_public(fresh)}

# ---------- Analysis ----------
ANALYSIS_SYSTEM_PROMPT = """You are "INSIDE OUT ENGINEER" — an expert reverse-engineering AI mentor.
You analyze photos of physical devices and produce a strictly-formatted JSON breakdown for a mobile app.

For every conclusion, you MUST assign a confidence STATUS:
- VERIFIED  : clearly visible from the image
- INFERRED  : reasoned from visual/technical evidence
- ESTIMATED : approximate value/spec
- UNKNOWN   : insufficient information

NEVER invent measurements. Prefer "UNKNOWN" over guessing.

Respond ONLY with valid JSON (no prose, no markdown fences) matching:
{
  "object": {"name": string, "one_liner": string, "status": "VERIFIED|INFERRED|ESTIMATED|UNKNOWN", "confidence": 0-100},
  "what_i_see": string,
  "components": [
    {"name": string, "purpose": string, "status": "VERIFIED|INFERRED|ESTIMATED|UNKNOWN", "confidence": 0-100, "voltage": string, "typical_cost_usd": string}
  ],
  "how_it_works": [ { "step": string, "explanation": string } ],
  "connections": [ { "from": string, "to": string, "signal": string, "why": string } ],
  "why_it_works": string,
  "layers": {
    "1_surface": string, "2_components": string, "3_connections": string, "4_physics": string,
    "5_electronics": string, "6_software": string, "7_system": string, "8_build": string
  },
  "bom": [ { "component": string, "quantity": number, "spec": string, "cost_usd": string, "status": "VERIFIED|INFERRED|ESTIMATED|UNKNOWN" } ],
  "rebuild_challenge": { "title": string, "difficulty": "Beginner|Intermediate|Advanced|Expert", "steps": [string] },
  "estimated_total_cost_usd": string,
  "safety": [string],
  "cannot_confirm": [string]
}
Adapt vocabulary to the user's experience_level. Keep strings concise."""

def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return {"error": "parse_failed", "raw": text[:2000]}

def _strip_data_url(b64: str) -> str:
    if b64.startswith("data:"):
        _, _, rest = b64.partition(",")
        return rest
    return b64

@api.post("/analyze")
async def analyze(body: AnalyzeIn, user=Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI service not configured")
    model_id = resolve_model(body.model, user)
    session_id = f"analyze-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY, session_id=session_id,
        system_message=ANALYSIS_SYSTEM_PROMPT,
    ).with_model("anthropic", model_id)

    img = ImageContent(image_base64=_strip_data_url(body.image_base64))
    prompt = (
        f"User experience level: {body.experience_level}.\n"
        "Analyze the physical device in this image and return ONLY the JSON per schema."
    )
    msg = UserMessage(text=prompt, file_contents=[img])

    full = ""
    try:
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                full += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logging.exception("Analyze failed")
        raise HTTPException(502, f"AI analysis failed: {e}")

    data = _extract_json(full)
    if "error" in data:
        raise HTTPException(502, "AI returned unparseable response")

    project_id = body.project_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    project_doc = {
        "id": project_id, "user_id": user["id"],
        "name": data.get("object", {}).get("name", "Untitled Project"),
        "description": data.get("object", {}).get("one_liner", ""),
        "image_base64": body.image_base64[:2_000_000],
        "analysis": data, "model_used": model_id,
        "created_at": now, "updated_at": now,
    }
    await db.projects.update_one({"id": project_id}, {"$set": project_doc}, upsert=True)
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"projects_count": 1 if not body.project_id else 0, "xp": 25}},
    )
    return {"project_id": project_id, "analysis": data}

# ---------- Projects ----------
@api.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    cursor = db.projects.find(
        {"user_id": user["id"]}, {"_id": 0, "image_base64": 0}
    ).sort("updated_at", -1)
    items = await cursor.to_list(200)
    return {"projects": items}

@api.get("/projects/{project_id}")
async def get_project(project_id: str, user=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not proj:
        raise HTTPException(404, "Project not found")
    return {"project": proj}

@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user=Depends(get_current_user)):
    res = await db.projects.delete_one({"id": project_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await db.chats.delete_many({"project_id": project_id})
    return {"ok": True}

# ---------- Chat ----------
CHAT_SYSTEM_PROMPT = """You are "INSIDE OUT ENGINEER" — a helpful, precise engineering mentor.
You are given a project's analysis JSON as context. Answer questions in context of THIS project.
Be concise, technical yet accessible. When uncertain, say so. Label conclusions with confidence
(VERIFIED/INFERRED/ESTIMATED/UNKNOWN) when relevant. Avoid encouraging unsafe experimentation."""

@api.post("/chat")
async def chat_stream(body: ChatIn, user=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": user["id"]}, {"_id": 0})
    if not proj:
        raise HTTPException(404, "Project not found")

    history = await db.chats.find(
        {"project_id": body.project_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)

    context_summary = json.dumps(proj.get("analysis", {}))[:6000]
    system = CHAT_SYSTEM_PROMPT + "\n\n--- PROJECT CONTEXT ---\n" + context_summary
    session_id = f"chat-{body.project_id}"
    model_id = resolve_model(body.model, user)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system,
    ).with_model("anthropic", model_id)

    now = datetime.now(timezone.utc).isoformat()
    await db.chats.insert_one({
        "id": str(uuid.uuid4()), "project_id": body.project_id, "user_id": user["id"],
        "role": "user", "content": body.message, "created_at": now,
    })

    history_text = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history[-8:])
    combined = (history_text + "\n" if history_text else "") + f"USER: {body.message}\nASSISTANT:"

    async def event_gen():
        buffer = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=combined)):
                if isinstance(ev, TextDelta):
                    buffer += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        await db.chats.insert_one({
            "id": str(uuid.uuid4()), "project_id": body.project_id, "user_id": user["id"],
            "role": "assistant", "content": buffer,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@api.get("/chat/{project_id}")
async def get_chat_history(project_id: str, user=Depends(get_current_user)):
    msgs = await db.chats.find(
        {"project_id": project_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return {"messages": msgs}

# ---------- Diagram (Nano Banana) ----------
@api.post("/generate-diagram")
async def generate_diagram(body: DiagramIn, user=Depends(get_current_user)):
    if GeminiImageGeneration is None:
        raise HTTPException(501, "Image gen library unavailable")
    proj = await db.projects.find_one({"id": body.project_id, "user_id": user["id"]}, {"_id": 0})
    if not proj:
        raise HTTPException(404, "Project not found")
    analysis = proj.get("analysis", {})
    obj_name = analysis.get("object", {}).get("name", "device")
    comps = ", ".join(c.get("name", "") for c in analysis.get("components", [])[:8])
    if body.kind == "circuit":
        prompt = (f"Clean minimal blueprint-style schematic diagram of a {obj_name}. "
                  f"Components: {comps}. Dark navy background, bright cyan (#00E5FF) circuit lines, "
                  "labeled nodes, technical drawing, high contrast.")
    elif body.kind == "xray":
        prompt = (f"Conceptual x-ray cutaway illustration of a {obj_name} showing internal parts "
                  f"({comps}). Deep obsidian background, glowing cyan outlines, blueprint aesthetic.")
    else:
        prompt = (f"Exploded view illustration of a {obj_name} with labeled parts: {comps}. "
                  "Blueprint aesthetic, dark navy background, cyan glowing line highlights, "
                  "components floating apart, clean vector technical illustration.")
    try:
        gen = GeminiImageGeneration(api_key=EMERGENT_LLM_KEY)
        images = await gen.generate_images(prompt=prompt, model="gemini-2.5-flash-image", number_of_images=1)
        if not images:
            raise HTTPException(502, "No image returned")
        import base64 as _b64
        b64 = _b64.b64encode(images[0]).decode()
        diagrams = proj.get("diagrams", {})
        diagrams[body.kind] = f"data:image/png;base64,{b64}"
        await db.projects.update_one({"id": body.project_id}, {"$set": {"diagrams": diagrams}})
        return {"image_base64": f"data:image/png;base64,{b64}", "kind": body.kind}
    except Exception as e:
        logging.exception("Diagram gen failed")
        raise HTTPException(502, f"Image generation failed: {e}")

@api.get("/")
async def root():
    return {"service": "INSIDE OUT API", "ok": True}

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def _shutdown():
    client.close()

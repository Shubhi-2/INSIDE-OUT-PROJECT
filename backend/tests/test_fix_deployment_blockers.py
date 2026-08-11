"""
Iteration 2 — Deployment blocker fix verification.

Covers only:
  FIX #1: JWT_SECRET is a required env var (server.py line ~36 uses os.environ["JWT_SECRET"]).
          Regression: login still works with the currently-configured JWT_SECRET.
  FIX #2: DELETE /api/auth/account
          - 401 without a valid Bearer token
          - with a valid token: deletes user + all their projects + all their chats
          - after deletion: /api/auth/me -> 401, login -> 401, DB has zero projects/chats
            for that user_id.

Run serialized:
  pytest /app/backend/tests/test_fix_deployment_blockers.py -v -n 0 \\
      --junitxml=/app/test_reports/pytest/pytest_results.xml
"""
import os
import re
import uuid
import pytest
import requests
from pymongo import MongoClient

# ---------- Config ----------
BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://build-inside-1.preview.emergentagent.com",
).rstrip("/")

# Direct DB access to verify cascade cleanup on the user_id
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


# ---------- FIX #1: JWT_SECRET required (static + regression) ----------
class TestJwtSecretRequired:
    """FIX #1: server.py must fail-fast when JWT_SECRET is missing (no dev fallback)."""

    def test_server_source_uses_required_env(self):
        """Static check: server.py MUST NOT fall back to 'dev-secret'."""
        with open("/app/backend/server.py") as f:
            src = f.read()
        # Positive: strict lookup present
        assert re.search(
            r"JWT_SECRET\s*=\s*os\.environ\[[\"']JWT_SECRET[\"']\]", src
        ), "Expected `JWT_SECRET = os.environ['JWT_SECRET']` in server.py"
        # Negative: no .get('JWT_SECRET', 'dev-secret') fallback
        assert "dev-secret" not in src, "Fallback 'dev-secret' still present in server.py"
        assert not re.search(
            r"os\.environ\.get\(\s*[\"']JWT_SECRET[\"']", src
        ), "server.py must NOT use os.environ.get for JWT_SECRET"

    def test_login_still_works_with_configured_secret(self, api_client):
        """Regression: seeded user can still login (secret env-var already set)."""
        # Ensure seeded user exists (idempotent-safe register)
        api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Seed User",
            "email": "test@insideout.app",
            "password": "testpass123",
            "experience_level": "Beginner",
        })
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@insideout.app",
            "password": "testpass123",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 20
        assert body["user"]["email"] == "test@insideout.app"


# ---------- FIX #2: DELETE /api/auth/account ----------
class TestDeleteAccount:
    """FIX #2: DELETE /api/auth/account — 401 unauth + cascade delete on user_id."""

    def test_delete_account_requires_auth(self, api_client):
        # No Bearer header
        r = api_client.delete(f"{BASE_URL}/api/auth/account")
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

        # Malformed / invalid token
        r2 = api_client.delete(
            f"{BASE_URL}/api/auth/account",
            headers={"Authorization": "Bearer not-a-real-token"},
        )
        assert r2.status_code == 401, f"expected 401, got {r2.status_code}: {r2.text}"

    def test_delete_account_full_cascade(self, api_client, test_image_b64):
        # ---- 1) Register a throwaway user ----
        suffix = uuid.uuid4().hex[:8]
        email = f"TEST_del_{suffix}@insideout.app"
        password = "TESTpass123!"
        reg = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST Delete Me",
            "email": email,
            "password": password,
            "experience_level": "Beginner",
        })
        assert reg.status_code == 200, reg.text
        token = reg.json()["token"]
        user_id = reg.json()["user"]["id"]
        auth = {"Authorization": f"Bearer {token}"}

        # ---- 2) Create a project via /api/analyze ----
        an = api_client.post(
            f"{BASE_URL}/api/analyze",
            json={"image_base64": test_image_b64, "experience_level": "Beginner"},
            headers=auth,
            timeout=120,
        )
        assert an.status_code == 200, f"/api/analyze failed: {an.status_code} {an.text[:400]}"
        project_id = an.json()["project_id"]
        assert isinstance(project_id, str) and len(project_id) > 10

        # ---- 3) Post a chat message (SSE) — consume so DB writes complete ----
        with api_client.post(
            f"{BASE_URL}/api/chat",
            json={"project_id": project_id, "message": "What is this device?"},
            headers=auth,
            stream=True,
            timeout=120,
        ) as ch:
            assert ch.status_code == 200, ch.text
            got_done = False
            for line in ch.iter_lines(decode_unicode=True):
                if line and line.startswith("data:") and '"done"' in line:
                    got_done = True
                    break
            assert got_done, "SSE stream did not emit done event"

        # Sanity: DB actually has rows for this user
        assert _db.projects.count_documents({"user_id": user_id}) >= 1
        assert _db.chats.count_documents({"user_id": user_id}) >= 1

        # ---- 4) DELETE /api/auth/account ----
        d = api_client.delete(f"{BASE_URL}/api/auth/account", headers=auth)
        assert d.status_code == 200, f"expected 200, got {d.status_code}: {d.text}"
        assert d.json() == {"ok": True}, d.text

        # ---- 5) Post-conditions ----
        # (i) /api/auth/me with same token -> 401 (user record gone)
        me = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth)
        assert me.status_code == 401, f"/api/auth/me should be 401 after delete, got {me.status_code}"

        # (ii) login as that user -> 401
        lg = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": email, "password": password,
        })
        assert lg.status_code == 401, f"login should 401 after delete, got {lg.status_code}"

        # (iii) DB: zero projects and chats for that user_id, user doc gone
        assert _db.projects.count_documents({"user_id": user_id}) == 0, \
            "projects for deleted user should be 0"
        assert _db.chats.count_documents({"user_id": user_id}) == 0, \
            "chats for deleted user should be 0"
        assert _db.users.count_documents({"id": user_id}) == 0, \
            "user document should be gone"

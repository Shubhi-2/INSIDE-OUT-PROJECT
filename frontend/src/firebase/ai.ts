import { GoogleGenerativeAI } from '@google/generative-ai';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, resolveModel } from './models';

const ANALYSIS_SYSTEM_PROMPT = `You are "INSIDE OUT ENGINEER" — an expert reverse-engineering AI mentor.
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
Adapt vocabulary to the user's experience_level. Keep strings concise.`;

const CHAT_SYSTEM_PROMPT = `You are "INSIDE OUT ENGINEER" — a helpful, precise engineering mentor.
You are given a project's analysis JSON as context. Answer questions in context of THIS project.
Be concise, technical yet accessible. When uncertain, say so. Label conclusions with confidence
(VERIFIED/INFERRED/ESTIMATED/UNKNOWN) when relevant. Avoid encouraging unsafe experimentation.`;

function geminiKey() {
  return (
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    ''
  );
}

function client() {
  const key = geminiKey();
  if (!key) throw new Error('Gemini API key not configured (EXPO_PUBLIC_GEMINI_API_KEY)');
  return new GoogleGenerativeAI(key);
}

function stripDataUrl(b64: string) {
  if (b64.startsWith('data:')) {
    const i = b64.indexOf(',');
    return i >= 0 ? b64.slice(i + 1) : b64;
  }
  return b64;
}

function mimeFromDataUrl(b64: string) {
  const m = /^data:([^;]+);base64,/.exec(b64);
  return m?.[1] || 'image/jpeg';
}

export function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* continue */
    }
  }
  return { error: 'parse_failed', raw: text.slice(0, 2000) };
}

export async function analyzeImage(opts: {
  imageBase64: string;
  experienceLevel?: string;
  model?: string | null;
  preferredModel?: string | null;
}): Promise<{ analysis: any; modelUsed: string }> {
  const modelId = resolveModel(opts.model, opts.preferredModel);
  const model = client().getGenerativeModel({
    model: modelId,
    systemInstruction: ANALYSIS_SYSTEM_PROMPT,
  });

  const prompt =
    `User experience level: ${opts.experienceLevel || 'Beginner'}.\n` +
    'Analyze the physical device in this image and return ONLY the JSON per schema.';

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: mimeFromDataUrl(opts.imageBase64),
        data: stripDataUrl(opts.imageBase64),
      },
    },
  ]);

  const text = result.response.text();
  const analysis = extractJson(text);
  if (analysis?.error === 'parse_failed') {
    throw new Error('AI returned unparseable response');
  }
  return { analysis, modelUsed: modelId };
}

export async function streamChat(opts: {
  message: string;
  analysis: any;
  history: { role: string; content: string }[];
  model?: string | null;
  preferredModel?: string | null;
  onDelta: (delta: string) => void;
}): Promise<string> {
  const modelId = resolveModel(opts.model, opts.preferredModel);
  const contextSummary = JSON.stringify(opts.analysis || {}).slice(0, 6000);
  const system = `${CHAT_SYSTEM_PROMPT}\n\n--- PROJECT CONTEXT ---\n${contextSummary}`;

  const model = client().getGenerativeModel({
    model: modelId,
    systemInstruction: system,
  });

  const contents = [
    ...opts.history.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: opts.message }] },
  ];

  const stream = await model.generateContentStream({ contents });
  let full = '';
  for await (const chunk of stream.stream) {
    const delta = chunk.text();
    if (delta) {
      full += delta;
      opts.onDelta(delta);
    }
  }
  return full;
}

export function listModels() {
  return {
    default: DEFAULT_GEMINI_MODEL,
    models: Object.entries(GEMINI_MODELS).map(([id, meta]) => ({ id, ...meta })),
  };
}

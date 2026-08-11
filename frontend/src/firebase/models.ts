export const GEMINI_MODELS = {
  'gemini-3.5-flash': {
    label: 'Flash 3.5',
    tier: 'balanced' as const,
    desc: 'Balanced default',
  },
  'gemini-flash-latest': {
    label: 'Flash Latest',
    tier: 'flagship' as const,
    desc: 'Alias to current flash',
  },
  'gemini-flash-lite-latest': {
    label: 'Flash Lite',
    tier: 'fast' as const,
    desc: 'Fastest & lowest cost',
  },
  'gemini-3-flash-preview': {
    label: 'Flash 3',
    tier: 'deep' as const,
    desc: 'Strong reasoning preview',
  },
};

export type GeminiModelId = keyof typeof GEMINI_MODELS;
export const DEFAULT_GEMINI_MODEL: GeminiModelId = 'gemini-3.5-flash';

export function resolveModel(requested?: string | null, preferred?: string | null): string {
  if (requested && requested in GEMINI_MODELS) return requested;
  if (preferred && preferred in GEMINI_MODELS) return preferred;
  return DEFAULT_GEMINI_MODEL;
}

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  experience_level: string;
  xp: number;
  projects_count: number;
  preferred_model?: string;
  created_at?: string;
};

export type ProjectDoc = {
  id: string;
  userId: string;
  name: string;
  description: string;
  imagePath?: string;
  imageUrl?: string;
  /** @deprecated kept for display fallback during migration */
  image_base64?: string;
  analysis: any;
  model_used: string;
  diagrams?: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  userId?: string;
};

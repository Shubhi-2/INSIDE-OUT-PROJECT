import { analyzeImage } from './ai';
import { getProject, upsertProject } from './db';
import { prepareScanImages } from './image';
import { ProjectDoc } from './models';

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function analyzeAndSaveProject(opts: {
  uid: string;
  /** Local file URI from image picker/camera (preferred). */
  imageUri: string;
  experienceLevel?: string;
  model?: string | null;
  preferredModel?: string | null;
  projectId?: string | null;
  onStatus?: (s: string) => void;
}): Promise<{ project_id: string; analysis: any }> {
  const projectId = opts.projectId || newId();
  const isNew = !opts.projectId;

  opts.onStatus?.('Preparing image...');
  const { forAi, forFirestore } = await prepareScanImages(opts.imageUri);

  opts.onStatus?.('Identifying object...');
  const { analysis, modelUsed } = await analyzeImage({
    imageBase64: forAi,
    experienceLevel: opts.experienceLevel,
    model: opts.model,
    preferredModel: opts.preferredModel,
  });

  const now = new Date().toISOString();
  const existing = opts.projectId ? await getProject(opts.uid, projectId) : null;

  // Store image ONCE only — duplicate imageUrl + image_base64 was blowing past 1MB
  const project: ProjectDoc = {
    id: projectId,
    userId: opts.uid,
    name: analysis?.object?.name || 'Untitled Project',
    description: analysis?.object?.one_liner || '',
    ...(forFirestore ? { imageUrl: forFirestore } : {}),
    analysis,
    model_used: modelUsed,
    diagrams: existing?.diagrams || {},
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  opts.onStatus?.('Saving project...');
  await upsertProject(project, isNew || !existing, opts.uid);
  return { project_id: projectId, analysis };
}

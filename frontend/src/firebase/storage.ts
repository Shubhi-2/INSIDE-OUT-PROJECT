/**
 * Spark-only image handling: no Firebase Storage.
 * Callers should pass an already-compressed data URL (see prepareScanImages).
 */

import { MAX_FIRESTORE_IMAGE_CHARS } from './image';

export function projectImagePath(uid: string, projectId: string) {
  return `users/${uid}/projects/${projectId}/photo.jpg`;
}

export async function uploadProjectImage(
  _uid: string,
  _projectId: string,
  dataUrlOrBase64: string,
): Promise<{ path?: string; url: string; inline?: string }> {
  if (!dataUrlOrBase64) {
    return { url: '' };
  }
  const dataUrl = dataUrlOrBase64.startsWith('data:')
    ? dataUrlOrBase64
    : `data:image/jpeg;base64,${dataUrlOrBase64}`;

  // Never store a corrupted truncated image — omit if still too large
  if (dataUrl.length > MAX_FIRESTORE_IMAGE_CHARS) {
    return { url: '' };
  }
  return { url: dataUrl, inline: dataUrl };
}

export async function deleteProjectImage(_uid: string, _projectId: string) {
  // No Storage on Spark — nothing to delete remotely.
}

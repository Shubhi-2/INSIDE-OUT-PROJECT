import * as ImageManipulator from 'expo-image-manipulator';

/** Max data-URL length for Firestore (~280KB leaves room for analysis JSON under 1MB). */
export const MAX_FIRESTORE_IMAGE_CHARS = 280_000;

function toDataUrl(base64: string) {
  return base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
}

async function compressUri(
  uri: string,
  maxWidth: number,
  compress: number,
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (!result.base64) throw new Error('Image compression failed');
  return toDataUrl(result.base64);
}

/**
 * Build a vision-ready image + a small Firestore-safe thumbnail from a local file URI.
 */
export async function prepareScanImages(localUri: string): Promise<{
  forAi: string;
  forFirestore: string;
}> {
  const forAi = await compressUri(localUri, 1024, 0.65);

  const steps: Array<{ w: number; q: number }> = [
    { w: 640, q: 0.45 },
    { w: 480, q: 0.35 },
    { w: 360, q: 0.3 },
    { w: 280, q: 0.25 },
  ];

  let forFirestore = '';
  for (const step of steps) {
    forFirestore = await compressUri(localUri, step.w, step.q);
    if (forFirestore.length <= MAX_FIRESTORE_IMAGE_CHARS) break;
  }

  if (forFirestore.length > MAX_FIRESTORE_IMAGE_CHARS) {
    // Prefer a successful write over a broken truncated image
    forFirestore = '';
  }

  return { forAi, forFirestore };
}

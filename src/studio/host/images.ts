import { assertStudioImageLimits } from "../../../core/studio.ts";

/**
 * Decode backend with M7 dimension gates applied before createImageBitmap.
 */
export async function decodeStudioImageBitmap(
  source: ImageBitmapSource,
  knownSize?: { width: number; height: number },
): Promise<ImageBitmap> {
  if (knownSize) {
    assertStudioImageLimits(knownSize.width, knownSize.height);
  }
  const bitmap = await createImageBitmap(source);
  try {
    assertStudioImageLimits(bitmap.width, bitmap.height);
  } catch (err) {
    bitmap.close();
    throw err;
  }
  return bitmap;
}

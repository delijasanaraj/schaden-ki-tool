// Verkleinert Fotos im Browser vor dem Upload (schont Datenvolumen des Nutzers
// und haelt die Anfrage unter typischen Hosting-Limits fuer die Body-Groesse).
export async function compressImage(file: File, maxEdge = 1400, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmapSafe(file);
  if (!bitmap) return file;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) return file;

  return new File([blob], renameToJpeg(file.name), { type: "image/jpeg" });
}

async function createImageBitmapSafe(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

function renameToJpeg(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}.jpg`;
}

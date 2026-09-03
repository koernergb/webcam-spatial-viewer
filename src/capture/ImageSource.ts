export async function loadImageFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

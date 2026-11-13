export const PHOTO_FILE_MAX = 10 * 1024 * 1024;
export const PHOTO_DATA_MAX = 200_000;

export function cleanProfilePhoto(value) {
  return typeof value === "string" && value.length <= PHOTO_DATA_MAX && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
}

export async function prepareProfilePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPG, PNG, WebP 사진을 선택해 주세요.");
  if (file.size > PHOTO_FILE_MAX)
    throw new Error("10MB 이하의 사진을 선택해 주세요.");
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("사진을 읽을 수 없어요. 다른 사진을 선택해 주세요.");
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("사진을 준비하지 못했어요. 다시 시도해 주세요.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 256, 256);
    const size = Math.min(image.width, image.height);
    ctx.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    image.close();
  }
}

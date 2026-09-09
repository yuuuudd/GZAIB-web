export async function prepareAvatar(file: Blob): Promise<Blob> {
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("请选择 10 MB 以内的头像图片。");
  if ((file.type && !file.type.startsWith("image/")) || file.type === "image/svg+xml") {
    throw new Error("请选择图库中的照片，如 JPG、PNG 或 WebP。");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("无法读取这张图片，请尝试从相册重新选择，或转为 JPG / PNG 后上传。");
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("图片尺寸无效，请重新选择。");
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("暂时无法处理图片，请换一个浏览器重试。");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Canvas falls back to PNG when the browser cannot encode WebP; the API accepts both.
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!compressed || !compressed.size || compressed.size > 5 * 1024 * 1024) {
      throw new Error("图片压缩失败，请换一张图片重试。");
    }
    return compressed;
  } finally {
    URL.revokeObjectURL(url);
  }
}

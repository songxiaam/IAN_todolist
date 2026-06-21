import type { NormalizedBBox } from '@/lib/image-crop-types';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** 浏览器端校正 EXIF 方向，输出与显示一致的 JPEG */
async function normalizeImageFile(
  file: File,
): Promise<{ file: File; url: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建画布');
      ctx.drawImage(bitmap, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('导出失败'))),
          'image/jpeg',
          0.92,
        );
      });

      const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
      const normalized = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
      return { file: normalized, url: URL.createObjectURL(normalized) };
    } finally {
      bitmap.close();
    }
  } catch {
    return { file, url: URL.createObjectURL(file) };
  }
}

async function cropImageToObjectUrl(imageUrl: string, bbox: NormalizedBBox): Promise<string> {
  const img = await loadImage(imageUrl);
  const left = Math.floor(bbox.x * img.naturalWidth);
  const top = Math.floor(bbox.y * img.naturalHeight);
  const width = Math.max(1, Math.floor(bbox.w * img.naturalWidth));
  const height = Math.max(1, Math.floor(bbox.h * img.naturalHeight));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('裁剪失败'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.92,
    );
  });
}

async function normalizeImageUrl(url: string): Promise<string> {
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('导出失败'))),
        'image/jpeg',
        0.92,
      );
    });
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

export { cropImageToObjectUrl, loadImage, normalizeImageFile, normalizeImageUrl };

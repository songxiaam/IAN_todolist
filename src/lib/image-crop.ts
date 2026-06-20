import { getSharp } from '@/lib/sharp-loader';

export interface NormalizedBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clampBBox(bbox: NormalizedBBox): NormalizedBBox {
  const x = Math.max(0, Math.min(1, bbox.x));
  const y = Math.max(0, Math.min(1, bbox.y));
  const w = Math.max(0.02, Math.min(1 - x, bbox.w));
  const h = Math.max(0.02, Math.min(1 - y, bbox.h));
  return { x, y, w, h };
}

async function getImageSize(buffer: Buffer): Promise<{ width: number; height: number }> {
  const sharp = await getSharp();
  const meta = await sharp(buffer).metadata();
  return { width: meta.width ?? 1, height: meta.height ?? 1 };
}

function bboxToPixels(
  bbox: NormalizedBBox,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const b = clampBBox(bbox);
  const left = Math.floor(b.x * width);
  const top = Math.floor(b.y * height);
  const cropW = Math.max(1, Math.floor(b.w * width));
  const cropH = Math.max(1, Math.floor(b.h * height));
  return {
    left,
    top,
    width: Math.min(cropW, width - left),
    height: Math.min(cropH, height - top),
  };
}

async function cropImageBuffer(
  sourceBuffer: Buffer,
  bbox: NormalizedBBox,
): Promise<Buffer> {
  const sharp = await getSharp();
  const { width, height } = await getImageSize(sourceBuffer);
  const region = bboxToPixels(bbox, width, height);
  return sharp(sourceBuffer)
    .extract(region)
    .jpeg({ quality: 90 })
    .toBuffer();
}

export { clampBBox, cropImageBuffer, bboxToPixels, getImageSize };

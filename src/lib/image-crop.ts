import { getSharp } from '@/lib/sharp-loader';
import type { NormalizedBBox } from '@/lib/image-crop-types';

export type { NormalizedBBox } from '@/lib/image-crop-types';
export { DEFAULT_MANUAL_BBOX } from '@/lib/image-crop-types';

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

/** 校正 EXIF 方向，返回与浏览器显示一致的像素数据 */
async function normalizeImageBuffer(sourceBuffer: Buffer): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp(sourceBuffer).rotate().jpeg({ quality: 92 }).toBuffer();
}

/** 自动旋转、限尺寸，供视觉模型识别（归一化坐标仍适用于原图比例） */
async function prepareVisionBuffer(
  sourceBuffer: Buffer,
): Promise<{ buffer: Buffer; mimeType: string; width: number; height: number }> {
  const sharp = await getSharp();
  const maxDim = 2048;
  const normalized = await sharp(sourceBuffer).rotate().jpeg({ quality: 92 }).toBuffer();
  let pipeline = sharp(normalized);
  const meta = await pipeline.metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  if (w > maxDim || h > maxDim) {
    pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true });
  }
  const buffer = await pipeline.jpeg({ quality: 92 }).toBuffer();
  const outMeta = await sharp(buffer).metadata();
  return {
    buffer,
    mimeType: 'image/jpeg',
    width: outMeta.width ?? w,
    height: outMeta.height ?? h,
  };
}

export { clampBBox, cropImageBuffer, bboxToPixels, getImageSize, prepareVisionBuffer, normalizeImageBuffer };

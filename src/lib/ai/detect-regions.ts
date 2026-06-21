import { chatCompletion, imageMessagePart, parseJson } from './client';
import { resolveModelRef } from './model-config';
import type { ResolvedModel } from './types';
import type { NormalizedBBox } from '@/lib/image-crop-types';
import { DEFAULT_MANUAL_BBOX } from '@/lib/image-crop-types';
import {
  normalizeRawBBox,
  postProcessDetectedRegions,
  finalizeRegions,
  expandBBox,
  mapLocalBBoxToGlobal,
  bandsToBboxes,
  isValidRefinement,
  clampBBox,
} from '@/lib/bbox-utils';
import { cropImageBuffer, prepareVisionBuffer } from '@/lib/image-crop';

const REFINE_PAD = 0.05;

function layoutPrompt(width: number, height: number): string {
  return `你是 K12 作业/试卷版面分析专家。图片约 ${width}×${height} 像素。

任务：识别每一道题的「垂直范围」和整页「内容区水平范围」。不要直接猜整框，先划分行带。

规则：
1. 一题一条：每道题输出 y_top（上边界）和 y_bottom（下边界），0~1 相对坐标
2. y_top 从题号/题干上沿开始，y_bottom 到该题最后一行作答/图形结束
3. 各题 y 范围可相邻贴合，按题面空白划分；不要故意在题目之间留未覆盖的空白
4. content_x / content_w 为所有题目共用的左右内容边界（排除页边空白）
5. 跳过页眉、页脚、页码、装订线；不要为大片空白单独建条
6. 若只有一道题，仅 1 条，且 y_bottom - y_top 通常 < 0.4

返回 JSON（不要 markdown）：
{
  "content_x": 0.07,
  "content_w": 0.86,
  "questions": [
    { "y_top": 0.12, "y_bottom": 0.24 },
    { "y_top": 0.26, "y_bottom": 0.39 }
  ]
}`;
}

const REFINE_REGION_PROMPT = `这是从作业中裁出的一块区域，应只包含「一道题」。

请返回该题的 bounding box（相对本图 0~1）：
- 上沿：题号或题干第一行顶部（可略含上方少量空白）
- 下沿：该题最后一行作答/选项/图形底部（可略含下方少量空白）
- 左右：紧贴文字/图形，确保题号、题干、选项、作答区完整显示，不要裁切文字

返回 JSON（不要 markdown）：
{ "bbox": { "x": 0.02, "y": 0.04, "w": 0.96, "h": 0.9 } }`;

const FALLBACK_REGIONS_PROMPT = `识别照片中每道题的矩形区域。一题一框，禁止重叠，紧贴题号+题干+作答。

坐标 0~1（x,y 左上角，w,h 宽高）。单题时 h<0.4。

返回 JSON：
{ "regions": [{ "x": 0.07, "y": 0.12, "w": 0.86, "h": 0.11 }] }`;

async function callVisionJson<T>(
  resolved: ResolvedModel,
  prompt: string,
  imageBuffer: Buffer,
  mimeType: string,
): Promise<T> {
  const content = await chatCompletion(
    resolved,
    [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }, imageMessagePart(imageBuffer, mimeType)],
      },
    ],
    true,
    0.05,
  );
  return parseJson<T>(content);
}

async function detectViaLayoutBands(
  resolved: ResolvedModel,
  imageBuffer: Buffer,
  mimeType: string,
  width: number,
  height: number,
): Promise<NormalizedBBox[] | null> {
  const parsed = await callVisionJson<{
    content_x?: number;
    content_w?: number;
    questions?: Array<{ y_top?: number; y_bottom?: number }>;
  }>(resolved, layoutPrompt(width, height), imageBuffer, mimeType);

  const contentX = Number(parsed.content_x);
  const contentW = Number(parsed.content_w);
  if (!Number.isFinite(contentX) || !Number.isFinite(contentW) || contentW < 0.15) {
    return null;
  }

  const bands = (parsed.questions ?? [])
    .map((q) => ({
      y_top: Number(q.y_top),
      y_bottom: Number(q.y_bottom),
    }))
    .filter(
      (b) =>
        Number.isFinite(b.y_top) &&
        Number.isFinite(b.y_bottom) &&
        b.y_bottom - b.y_top >= 0.025 &&
        b.y_top >= 0 &&
        b.y_bottom <= 1.01,
    )
    .sort((a, b) => a.y_top - b.y_top);

  if (bands.length === 0) return null;

  const fixedBands: Array<{ y_top: number; y_bottom: number }> = [];
  for (const band of bands) {
    let yTop = clampBBox({ x: 0, y: band.y_top, w: 1, h: band.y_bottom - band.y_top }).y;
    let yBottom = band.y_bottom;
    if (fixedBands.length > 0) {
      const prev = fixedBands[fixedBands.length - 1];
      if (yTop < prev.y_bottom) {
        const mid = (prev.y_bottom + yTop) / 2;
        prev.y_bottom = mid;
        yTop = mid;
      }
    }
    if (yBottom <= yTop + 0.02) continue;
    fixedBands.push({ y_top: yTop, y_bottom: Math.min(1, yBottom) });
  }

  for (let i = 0; i < fixedBands.length - 1; i++) {
    const cur = fixedBands[i];
    const next = fixedBands[i + 1];
    if (next.y_top > cur.y_bottom) {
      const mid = (cur.y_bottom + next.y_top) / 2;
      cur.y_bottom = mid;
      next.y_top = mid;
    }
  }

  const content = clampBBox({ x: contentX, y: 0, w: contentW, h: 0.1 });
  const boxes = bandsToBboxes(content.x, content.w, fixedBands);

  return boxes.length > 0 ? boxes : null;
}

async function detectViaFullBboxes(
  resolved: ResolvedModel,
  imageBuffer: Buffer,
  mimeType: string,
): Promise<NormalizedBBox[]> {
  const parsed = await callVisionJson<{ regions?: Array<Partial<NormalizedBBox>> }>(
    resolved,
    FALLBACK_REGIONS_PROMPT,
    imageBuffer,
    mimeType,
  );
  return postProcessDetectedRegions((parsed.regions ?? []).map(normalizeRawBBox));
}

async function refineSingleRegion(
  resolved: ResolvedModel,
  sourceBuffer: Buffer,
  mimeType: string,
  rough: NormalizedBBox,
): Promise<NormalizedBBox> {
  const expanded = expandBBox(rough, REFINE_PAD);
  let cropBuffer: Buffer;
  try {
    cropBuffer = await cropImageBuffer(sourceBuffer, expanded);
  } catch {
    return rough;
  }

  try {
    const parsed = await callVisionJson<{ bbox?: Partial<NormalizedBBox> }>(
      resolved,
      REFINE_REGION_PROMPT,
      cropBuffer,
      'image/jpeg',
    );
    if (!parsed.bbox) return rough;
    const local = normalizeRawBBox(parsed.bbox);
    if (!isValidRefinement(local, expanded)) return rough;
    return mapLocalBBoxToGlobal(local, expanded);
  } catch {
    return rough;
  }
}

async function refineAllRegions(
  resolved: ResolvedModel,
  sourceBuffer: Buffer,
  mimeType: string,
  regions: NormalizedBBox[],
): Promise<NormalizedBBox[]> {
  return Promise.all(
    regions.map((rough) => refineSingleRegion(resolved, sourceBuffer, mimeType, rough)),
  );
}

async function detectQuestionRegions(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<NormalizedBBox[]> {
  const resolved = resolveModelRef('vision_analyze', 'other');
  if (!resolved) {
    throw new Error('未配置题目识别视觉模型（vision_analyze）');
  }

  const prepared = await prepareVisionBuffer(imageBuffer);
  const { buffer, mimeType: visionMime, width, height } = prepared;

  let rough =
    (await detectViaLayoutBands(resolved, buffer, visionMime, width, height)) ??
    (await detectViaFullBboxes(resolved, buffer, visionMime));

  if (rough.length === 0) {
    return [DEFAULT_MANUAL_BBOX];
  }

  const refined = await refineAllRegions(resolved, buffer, visionMime, rough);
  const final = finalizeRegions(refined);

  return final.length > 0 ? final : [DEFAULT_MANUAL_BBOX];
}

export { detectQuestionRegions, normalizeRawBBox };

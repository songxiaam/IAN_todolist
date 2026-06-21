import type { NormalizedBBox } from '@/lib/image-crop-types';
import { DEFAULT_MANUAL_BBOX } from '@/lib/image-crop-types';

const MIN_SIZE = 0.025;
const EDGE_PAD = 0.012;
const HORIZONTAL_PAD = 0.012;

function clampBBox(bbox: NormalizedBBox): NormalizedBBox {
  let { x, y, w, h } = bbox;
  w = Math.max(MIN_SIZE, Math.min(1, w));
  h = Math.max(MIN_SIZE, Math.min(1, h));
  x = Math.max(0, Math.min(1 - w, x));
  y = Math.max(0, Math.min(1 - h, y));
  return { x, y, w, h };
}

function bboxArea(b: NormalizedBBox): number {
  return b.w * b.h;
}

function bboxIoU(a: NormalizedBBox, b: NormalizedBBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  return inter / (bboxArea(a) + bboxArea(b) - inter);
}

function sortReadingOrder(regions: NormalizedBBox[]): NormalizedBBox[] {
  return [...regions].map(clampBBox).sort((a, b) => {
    const cyA = a.y + a.h / 2;
    const cyB = b.y + b.h / 2;
    if (Math.abs(cyA - cyB) > 0.04) return cyA - cyB;
    return a.x - b.x;
  });
}

function dedupeOverlapping(regions: NormalizedBBox[]): NormalizedBBox[] {
  const sorted = sortReadingOrder(regions);
  const kept: NormalizedBBox[] = [];

  for (const box of sorted) {
    let skip = false;
    for (let i = 0; i < kept.length; i++) {
      const iou = bboxIoU(kept[i], box);
      if (iou > 0.35) {
        if (bboxArea(box) < bboxArea(kept[i])) {
          kept[i] = { ...box };
        }
        skip = true;
        break;
      }
      const vOverlap =
        Math.min(kept[i].y + kept[i].h, box.y + box.h) - Math.max(kept[i].y, box.y);
      if (vOverlap > Math.min(kept[i].h, box.h) * 0.5) {
        skip = true;
        break;
      }
    }
    if (!skip) kept.push({ ...box });
  }
  return kept;
}

/** 相邻选框在中点相接：重叠则对半分，有间隙则各自扩展填满，避免题目被裁切 */
function alignAdjacentBoxes(regions: NormalizedBBox[]): NormalizedBBox[] {
  if (regions.length <= 1) return regions.map(clampBBox);

  const result = sortReadingOrder(regions).map((b) => ({ ...b }));

  for (let i = 0; i < result.length - 1; i++) {
    const cur = result[i];
    const next = result[i + 1];
    const mid = (cur.y + cur.h + next.y) / 2;

    cur.h = Math.max(MIN_SIZE, mid - cur.y);
    const nextBottom = next.y + next.h;
    next.y = mid;
    next.h = Math.max(MIN_SIZE, nextBottom - mid);
  }

  return result.map(clampBBox);
}

function expandHorizontalMargin(regions: NormalizedBBox[], pad = HORIZONTAL_PAD): NormalizedBBox[] {
  return regions.map((b) =>
    clampBBox({ x: b.x - pad, y: b.y, w: b.w + pad * 2, h: b.h }),
  );
}

function expandEdgePadding(regions: NormalizedBBox[], pad = EDGE_PAD): NormalizedBBox[] {
  if (regions.length === 0) return regions;

  const result = regions.map((b) => ({ ...b }));
  result[0].y = Math.max(0, result[0].y - pad);
  result[0].h = Math.min(1 - result[0].y, result[0].h + pad);

  const last = result[result.length - 1];
  last.h = Math.min(1 - last.y, last.h + pad);

  return result.map(clampBBox);
}

function applyLayoutTuning(regions: NormalizedBBox[]): NormalizedBBox[] {
  if (regions.length === 0) return regions;
  const tuned = expandEdgePadding(alignAdjacentBoxes(expandHorizontalMargin(regions)));
  return refineSingleQuestion(tuned);
}

function filterUnreasonable(regions: NormalizedBBox[]): NormalizedBBox[] {
  return regions.filter((b) => {
    if (b.w < 0.08 || b.h < 0.025) return false;
    if (b.w > 0.98 && b.h > 0.85) return false;
    return true;
  });
}

function refineSingleQuestion(regions: NormalizedBBox[]): NormalizedBBox[] {
  if (regions.length !== 1) return regions;
  const b = regions[0];
  if (b.h > 0.72 && b.y < 0.1) {
    return [DEFAULT_MANUAL_BBOX];
  }
  if (b.h < 0.055 && b.w > 0.45) {
    return [clampBBox({ ...b, h: Math.min(0.25, Math.max(0.1, b.h * 2.2)) })];
  }
  return regions;
}

function refineAlignedBboxes(regions: NormalizedBBox[]): NormalizedBBox[] {
  if (regions.length === 0) return regions;
  return applyLayoutTuning(regions);
}

function expandBBox(bbox: NormalizedBBox, pad: number): NormalizedBBox {
  return clampBBox({
    x: bbox.x - pad,
    y: bbox.y - pad,
    w: bbox.w + pad * 2,
    h: bbox.h + pad * 2,
  });
}

function mapLocalBBoxToGlobal(local: NormalizedBBox, parent: NormalizedBBox): NormalizedBBox {
  return clampBBox({
    x: parent.x + local.x * parent.w,
    y: parent.y + local.y * parent.h,
    w: local.w * parent.w,
    h: local.h * parent.h,
  });
}

function bandsToBboxes(
  contentX: number,
  contentW: number,
  bands: Array<{ y_top: number; y_bottom: number }>,
): NormalizedBBox[] {
  return bands
    .map((band) =>
      clampBBox({
        x: contentX,
        y: band.y_top,
        w: contentW,
        h: band.y_bottom - band.y_top,
      }),
    )
    .filter((b) => b.h >= MIN_SIZE && b.w >= 0.08);
}

function finalizeRegions(regions: NormalizedBBox[]): NormalizedBBox[] {
  return applyLayoutTuning(sortReadingOrder(regions));
}

function isValidRefinement(
  local: NormalizedBBox,
  rough: NormalizedBBox,
): boolean {
  if (local.w < 0.05 || local.h < 0.05) return false;
  if (local.w > 0.995 && local.h > 0.995) return false;
  const global = mapLocalBBoxToGlobal(local, rough);
  const roughArea = rough.w * rough.h;
  const globalArea = global.w * global.h;
  if (globalArea < roughArea * 0.08) return false;
  if (globalArea > roughArea * 1.25) return false;
  return true;
}

function normalizeRawBBox(raw: Partial<NormalizedBBox>): NormalizedBBox {
  return clampBBox({
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    w: Number(raw.w) || 0.9,
    h: Number(raw.h) || 0.1,
  });
}

function postProcessDetectedRegions(raw: NormalizedBBox[]): NormalizedBBox[] {
  let regions = raw.map(normalizeRawBBox).filter((b) => b.w > 0.03 && b.h > 0.02);
  if (regions.length === 0) return [DEFAULT_MANUAL_BBOX];

  regions = filterUnreasonable(regions);
  if (regions.length === 0) return [DEFAULT_MANUAL_BBOX];

  regions = dedupeOverlapping(regions);
  if (regions.length === 0) return [DEFAULT_MANUAL_BBOX];

  regions = applyLayoutTuning(regions);

  return regions.length > 0 ? regions : [DEFAULT_MANUAL_BBOX];
}

export {
  clampBBox,
  bboxIoU,
  sortReadingOrder,
  normalizeRawBBox,
  postProcessDetectedRegions,
  refineAlignedBboxes,
  alignAdjacentBoxes,
  expandBBox,
  mapLocalBBoxToGlobal,
  bandsToBboxes,
  finalizeRegions,
  isValidRefinement,
};

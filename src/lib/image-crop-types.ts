export interface NormalizedBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_MANUAL_BBOX: NormalizedBBox = { x: 0.05, y: 0.05, w: 0.9, h: 0.2 };

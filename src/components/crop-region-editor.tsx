'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { NormalizedBBox } from '@/lib/image-crop-types';
import { DEFAULT_MANUAL_BBOX } from '@/lib/image-crop-types';
import {
  CropImageStage,
  bboxToOverlayStyle,
  getNormalizedPoint,
  clientToLocal,
} from '@/components/crop-image-stage';

export type { NormalizedBBox };

interface CropRegionEditorProps {
  imageUrl: string;
  initialBBox?: NormalizedBBox;
  regionLabel?: string;
  onConfirm: (bbox: NormalizedBBox) => void;
  onDelete?: () => void;
  onCancel: () => void;
  isNew?: boolean;
}

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  handle: Handle;
  startX: number;
  startY: number;
  startBox: NormalizedBBox;
}

const MIN_SIZE = 0.03;

function clampMove(box: NormalizedBBox): NormalizedBBox {
  const w = Math.max(MIN_SIZE, Math.min(1, box.w));
  const h = Math.max(MIN_SIZE, Math.min(1, box.h));
  const x = Math.max(0, Math.min(1 - w, box.x));
  const y = Math.max(0, Math.min(1 - h, box.y));
  return { x, y, w, h };
}

function applyHandle(handle: Handle, start: NormalizedBBox, dx: number, dy: number): NormalizedBBox {
  const right = start.x + start.w;
  const bottom = start.y + start.h;

  switch (handle) {
    case 'move':
      return clampMove({ ...start, x: start.x + dx, y: start.y + dy });
    case 'se': {
      const w = Math.max(MIN_SIZE, Math.min(1 - start.x, start.w + dx));
      const h = Math.max(MIN_SIZE, Math.min(1 - start.y, start.h + dy));
      return { x: start.x, y: start.y, w, h };
    }
    case 'sw': {
      const newRight = right;
      let newX = start.x + dx;
      newX = Math.max(0, Math.min(newRight - MIN_SIZE, newX));
      const w = newRight - newX;
      const h = Math.max(MIN_SIZE, Math.min(1 - start.y, start.h + dy));
      return { x: newX, y: start.y, w, h };
    }
    case 'ne': {
      const newBottom = bottom;
      let newY = start.y + dy;
      newY = Math.max(0, Math.min(newBottom - MIN_SIZE, newY));
      const h = newBottom - newY;
      const w = Math.max(MIN_SIZE, Math.min(1 - start.x, start.w + dx));
      return { x: start.x, y: newY, w, h };
    }
    case 'nw': {
      const newRight = right;
      const newBottom = bottom;
      let newX = Math.max(0, Math.min(newRight - MIN_SIZE, start.x + dx));
      let newY = Math.max(0, Math.min(newBottom - MIN_SIZE, start.y + dy));
      return { x: newX, y: newY, w: newRight - newX, h: newBottom - newY };
    }
    default:
      return start;
  }
}

function localDragToBox(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  rect: DOMRect,
): NormalizedBBox {
  const x1 = Math.min(startX, currentX) / rect.width;
  const y1 = Math.min(startY, currentY) / rect.height;
  const x2 = Math.max(startX, currentX) / rect.width;
  const y2 = Math.max(startY, currentY) / rect.height;
  return clampMove({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
}

export function CropRegionEditor({
  imageUrl,
  initialBBox = DEFAULT_MANUAL_BBOX,
  regionLabel,
  onConfirm,
  onDelete,
  onCancel,
  isNew = false,
}: CropRegionEditorProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<NormalizedBBox>(clampMove(initialBBox));
  const dragRef = useRef<DragState | null>(null);
  const redrawRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [box, setBox] = useState<NormalizedBBox>(() => clampMove(initialBBox));
  const [previewBox, setPreviewBox] = useState<NormalizedBBox | null>(null);
  const [redrawMode, setRedrawMode] = useState(isNew);
  const [redrawPreview, setRedrawPreview] = useState<NormalizedBBox | null>(null);

  boxRef.current = box;

  const bboxKey = `${initialBBox.x},${initialBBox.y},${initialBBox.w},${initialBBox.h}`;

  useEffect(() => {
    const next = clampMove(initialBBox);
    boxRef.current = next;
    setBox(next);
    setPreviewBox(null);
    setRedrawPreview(null);
    dragRef.current = null;
    redrawRef.current = null;
    setRedrawMode(isNew);
  }, [imageUrl, bboxKey, isNew, initialBBox]);

  const getImg = () => imgRef.current;

  const startDrag = (e: React.PointerEvent, handle: Handle) => {
    if (redrawMode) return;
    e.preventDefault();
    e.stopPropagation();
    const img = getImg();
    const el = stageRef.current;
    if (!img || !el) return;

    const { nx, ny } = getNormalizedPoint(img, e.clientX, e.clientY);
    dragRef.current = {
      handle,
      startX: nx,
      startY: ny,
      startBox: { ...boxRef.current },
    };
    setPreviewBox(boxRef.current);
    el.setPointerCapture(e.pointerId);
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (!redrawMode) return;
    const img = getImg();
    const el = stageRef.current;
    if (!img || !el) return;

    const { rect } = getNormalizedPoint(img, e.clientX, e.clientY);
    const { x, y } = clientToLocal(e.clientX, e.clientY, rect);
    redrawRef.current = { startX: x, startY: y, currentX: x, currentY: y };
    setRedrawPreview(null);
    el.setPointerCapture(e.pointerId);
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    const img = getImg();
    if (!img) return;

    if (redrawRef.current) {
      const { rect } = getNormalizedPoint(img, e.clientX, e.clientY);
      const { x, y } = clientToLocal(e.clientX, e.clientY, rect);
      redrawRef.current = { ...redrawRef.current, currentX: x, currentY: y };
      setRedrawPreview(
        localDragToBox(redrawRef.current.startX, redrawRef.current.startY, x, y, rect),
      );
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    const { nx, ny } = getNormalizedPoint(img, e.clientX, e.clientY);
    setPreviewBox(applyHandle(drag.handle, drag.startBox, nx - drag.startX, ny - drag.startY));
  };

  const onStagePointerUp = (e: React.PointerEvent) => {
    const img = getImg();

    if (redrawRef.current && img) {
      const { rect } = getNormalizedPoint(img, e.clientX, e.clientY);
      const r = redrawRef.current;
      const next = localDragToBox(r.startX, r.startY, r.currentX, r.currentY, rect);
      if (next.w > MIN_SIZE && next.h > MIN_SIZE) {
        boxRef.current = next;
        setBox(next);
      }
      redrawRef.current = null;
      setRedrawPreview(null);
      setRedrawMode(false);
    }

    const drag = dragRef.current;
    if (drag && img) {
      const { nx, ny } = getNormalizedPoint(img, e.clientX, e.clientY);
      const next = applyHandle(drag.handle, drag.startBox, nx - drag.startX, ny - drag.startY);
      boxRef.current = next;
      setBox(next);
    }

    dragRef.current = null;
    setPreviewBox(null);

    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const displayBox = previewBox ?? box;
  const showInteractive = imgLoaded && !redrawMode;

  return (
    <div className="space-y-3 pb-4">
      <p className="text-center text-sm text-[#8D6E63]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
        {redrawMode
          ? '在图片上拖动框选题目区域'
          : regionLabel
            ? `调整 ${regionLabel}，拖动框内移动、拖角缩放`
            : '拖动框内移动，拖角缩放选区'}
      </p>

      <div
        ref={stageRef}
        className={`touch-none select-none ${redrawMode ? 'cursor-crosshair' : ''}`}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerDown={onStagePointerDown}
      >
        <CropImageStage
          imageUrl={imageUrl}
          imageRef={imgRef}
          onImageLoad={() => setImgLoaded(true)}
        >
          {showInteractive && (
            <div
              className="absolute border-2 border-[#7CB342] bg-[#7CB342]/10"
              style={bboxToOverlayStyle(displayBox)}
            >
              <div
                className="absolute inset-0 z-0 cursor-move touch-none"
                onPointerDown={(e) => startDrag(e, 'move')}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <div
                  key={corner}
                  className={`absolute z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#7CB342] bg-white shadow touch-none ${
                    corner === 'nw'
                      ? 'left-0 top-0 cursor-nwse-resize'
                      : corner === 'ne'
                        ? 'left-full top-0 cursor-nesw-resize'
                        : corner === 'sw'
                          ? 'left-0 top-full cursor-nesw-resize'
                          : 'left-full top-full cursor-nwse-resize'
                  }`}
                  onPointerDown={(e) => startDrag(e, corner)}
                />
              ))}
            </div>
          )}

          {redrawPreview && (
            <div
              className="pointer-events-none absolute border-2 border-dashed border-[#FFB74D] bg-[#FFB74D]/10"
              style={bboxToOverlayStyle(redrawPreview)}
            />
          )}
        </CropImageStage>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="rounded border border-[#FFB74D] px-3 py-1.5 text-sm text-[#FFB74D]"
          onClick={() => setRedrawMode(true)}
        >
          重新框选
        </button>
        {onDelete && !isNew && (
          <button
            type="button"
            className="flex items-center gap-1 rounded border border-[#EF5350] px-3 py-1.5 text-sm text-[#EF5350]"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            删除此题
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-lg border-2 border-[#D7CCC8] py-2.5 text-[#8D6E63]"
          onClick={onCancel}
        >
          返回
        </button>
        <button
          type="button"
          className="flex-1 py-2.5 crayon-button text-[#FFFDE7]"
          disabled={!imgLoaded}
          onClick={() => onConfirm(boxRef.current)}
        >
          确认选区
        </button>
      </div>
    </div>
  );
}

export { DEFAULT_MANUAL_BBOX } from '@/lib/image-crop-types';

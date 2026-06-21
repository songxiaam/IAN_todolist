'use client';

import { useCallback, useRef, useState } from 'react';
import type { NormalizedBBox } from '@/lib/image-crop-types';

interface ImageCropSelectorProps {
  imageUrl: string;
  onConfirm: (regions: NormalizedBBox[]) => void;
  onCancel: () => void;
  confirmLabel?: string;
}

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

function toNormalized(
  drag: DragState,
  rect: DOMRect,
): NormalizedBBox {
  const x1 = Math.min(drag.startX, drag.currentX);
  const y1 = Math.min(drag.startY, drag.currentY);
  const x2 = Math.max(drag.startX, drag.currentX);
  const y2 = Math.max(drag.startY, drag.currentY);
  return {
    x: x1 / rect.width,
    y: y1 / rect.height,
    w: Math.max(0.02, (x2 - x1) / rect.width),
    h: Math.max(0.02, (y2 - y1) / rect.height),
  };
}

export function ImageCropSelector({
  imageUrl,
  onConfirm,
  onCancel,
  confirmLabel = '确认添加',
}: ImageCropSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [regions, setRegions] = useState<NormalizedBBox[]>([]);
  const [dragging, setDragging] = useState<DragState | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragging({ startX: x, startY: y, currentX: x, currentY: y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragging({
      ...dragging,
      currentX: e.clientX - rect.left,
      currentY: e.clientY - rect.top,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const box = toNormalized(dragging, rect);
    if (box.w > 0.03 && box.h > 0.03) {
      setRegions((prev) => [...prev, box]);
    }
    setDragging(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const removeRegion = (index: number) => {
    setRegions((prev) => prev.filter((_, i) => i !== index));
  };

  const renderBox = useCallback(
    (box: NormalizedBBox, key: string, dashed = false) => (
      <div
        key={key}
        className={`absolute border-2 ${dashed ? 'border-dashed border-[#FFB74D]' : 'border-[#7CB342]'} bg-[#7CB342]/10 pointer-events-none`}
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
        }}
      />
    ),
    [],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#8D6E63] text-center" style={{ fontFamily: "'Patrick Hand', cursive" }}>
        在图片上拖动框选错题区域，可框选多个
      </p>
      <div
        ref={containerRef}
        className="relative mx-auto max-w-full touch-none select-none cursor-crosshair sketchy-border rounded-lg overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img src={imageUrl} alt="选区" className="w-full block" draggable={false} />
        {regions.map((r, i) => renderBox(r, `r-${i}`))}
        {dragging && containerRef.current &&
          renderBox(toNormalized(dragging, containerRef.current.getBoundingClientRect()), 'drag', true)}
      </div>

      {regions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {regions.map((_, i) => (
            <button
              key={i}
              className="px-2 py-1 text-xs border border-[#EF5350] text-[#EF5350] rounded"
              onClick={() => removeRegion(i)}
            >
              删除选区 {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button className="flex-1 py-2 border-2 border-[#D7CCC8] rounded-lg text-[#8D6E63]" onClick={onCancel}>
          取消
        </button>
        <button
          className="flex-1 py-2 crayon-button text-[#FFFDE7] disabled:opacity-50"
          disabled={regions.length === 0}
          onClick={() => onConfirm(regions)}
        >
          {confirmLabel} ({regions.length})
        </button>
      </div>
    </div>
  );
}

export type { NormalizedBBox };

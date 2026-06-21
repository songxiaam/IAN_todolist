'use client';

import type { NormalizedBBox } from '@/lib/image-crop-types';
import { CropImageStage, bboxToOverlayStyle } from '@/components/crop-image-stage';

interface BboxOverlayItem {
  id: string;
  bbox: NormalizedBBox;
  label?: string;
  onClick?: () => void;
  onDelete?: () => void;
}

interface ImageWithBboxOverlayProps {
  imageUrl: string;
  boxes: BboxOverlayItem[];
  className?: string;
}

export function ImageWithBboxOverlay({
  imageUrl,
  boxes,
  className = '',
}: ImageWithBboxOverlayProps) {
  return (
    <div className={className}>
      <CropImageStage imageUrl={imageUrl}>
        {boxes.map((box) => (
          <div
            key={box.id}
            className="absolute border-2 border-[#7CB342] bg-[#7CB342]/10"
            style={bboxToOverlayStyle(box.bbox)}
          >
            {box.onClick && (
              <button
                type="button"
                className="absolute inset-0 flex items-start justify-start p-1"
                onClick={box.onClick}
              >
                {box.label && (
                  <span className="rounded bg-[#7CB342] px-1.5 py-0.5 text-xs text-white">
                    {box.label}
                  </span>
                )}
              </button>
            )}
            {box.onDelete && (
              <button
                type="button"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#EF5350] bg-white text-[#EF5350] shadow"
                onClick={(e) => {
                  e.stopPropagation();
                  box.onDelete?.();
                }}
                aria-label="删除选区"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </CropImageStage>
    </div>
  );
}

export function ImageWithSingleBbox({
  imageUrl,
  bbox,
  className,
}: {
  imageUrl: string;
  bbox: NormalizedBBox;
  className?: string;
}) {
  return (
    <ImageWithBboxOverlay
      imageUrl={imageUrl}
      boxes={[{ id: 'single', bbox }]}
      className={className}
    />
  );
}

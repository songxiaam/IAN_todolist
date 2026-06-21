'use client';

import type { NormalizedBBox } from '@/lib/image-crop-types';
import { ImageWithSingleBbox } from '@/components/image-with-bbox-overlay';

interface WrongQuestionSourceViewerProps {
  imageUrl: string;
  bbox: NormalizedBBox;
  onRecrop: () => void;
}

export function WrongQuestionSourceViewer({
  imageUrl,
  bbox,
  onRecrop,
}: WrongQuestionSourceViewerProps) {
  return (
    <div className="space-y-3 pb-4">
      <p className="text-center text-sm text-[#8D6E63]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
        原始试卷 · 绿色框为当前选区
      </p>
      <ImageWithSingleBbox imageUrl={imageUrl} bbox={bbox} />
      <button
        type="button"
        className="w-full py-2.5 crayon-button text-[#FFFDE7]"
        onClick={onRecrop}
      >
        重新框选
      </button>
    </div>
  );
}

'use client';

import { Plus } from 'lucide-react';
import type { NormalizedBBox } from '@/lib/image-crop-types';
import { ImageWithBboxOverlay } from '@/components/image-with-bbox-overlay';

export interface CropRegionItem {
  id: string;
  bbox: NormalizedBBox;
  previewUrl?: string;
  label?: string;
}

interface CropRegionsOverviewProps {
  imageUrl: string;
  regions: CropRegionItem[];
  onEditRegion: (index: number) => void;
  onAddRegion: () => void;
  onDeleteRegion: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  loading?: boolean;
  hint?: string;
}

export function CropRegionsOverview({
  imageUrl,
  regions,
  onEditRegion,
  onAddRegion,
  onDeleteRegion,
  onConfirm,
  onCancel,
  confirmLabel = '确认收录',
  loading = false,
  hint,
}: CropRegionsOverviewProps) {
  return (
    <div className="space-y-3 pb-4">
      <p className="text-center text-sm text-[#8D6E63]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
        {hint ?? '点击选区可编辑调整，或手动添加新题目'}
      </p>

      <ImageWithBboxOverlay
        imageUrl={imageUrl}
        boxes={regions.map((region, index) => ({
          id: region.id,
          bbox: region.bbox,
          label: region.label ?? String(index + 1),
          onClick: () => onEditRegion(index),
          onDelete: () => onDeleteRegion(index),
        }))}
      />

      {regions.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {regions.map((region, index) => (
            <button
              key={region.id}
              type="button"
              className="overflow-hidden rounded-lg border-2 border-[#D7CCC8] active:border-[#7CB342]"
              onClick={() => onEditRegion(index)}
            >
              {region.previewUrl ? (
                <img src={region.previewUrl} alt={`第 ${index + 1} 题`} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-[#F5E6D3] text-sm text-[#8D6E63]">
                  {index + 1}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#7CB342] py-3 text-sm text-[#7CB342]"
        onClick={onAddRegion}
      >
        <Plus className="h-4 w-4" />
        手动框选
      </button>

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-lg border-2 border-[#D7CCC8] py-2.5 text-[#8D6E63]"
          onClick={onCancel}
          disabled={loading}
        >
          取消
        </button>
        <button
          type="button"
          className="flex-1 py-2.5 crayon-button text-[#FFFDE7] disabled:opacity-50"
          disabled={regions.length === 0 || loading}
          onClick={onConfirm}
        >
          {loading ? '处理中...' : `${confirmLabel} (${regions.length})`}
        </button>
      </div>
    </div>
  );
}

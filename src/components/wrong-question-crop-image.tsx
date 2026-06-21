'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { NormalizedBBox } from '@/lib/image-crop-types';
import { cropImageToObjectUrl, normalizeImageUrl } from '@/lib/crop-preview';

interface WrongQuestionCropImageProps {
  originalImageUrl?: string | null;
  cropBbox?: NormalizedBBox | null;
  legacyImageUrl?: string | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

export function WrongQuestionCropImage({
  originalImageUrl,
  cropBbox,
  legacyImageUrl,
  alt = '',
  className = '',
  onClick,
}: WrongQuestionCropImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cropObjectUrl: string | null = null;
    let normalizedObjectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        if (originalImageUrl && cropBbox) {
          const normalized = await normalizeImageUrl(originalImageUrl);
          if (normalized !== originalImageUrl) {
            normalizedObjectUrl = normalized;
          }
          cropObjectUrl = await cropImageToObjectUrl(normalized, cropBbox);
          if (!cancelled) setSrc(cropObjectUrl);
        } else if (legacyImageUrl) {
          if (!cancelled) setSrc(legacyImageUrl);
        } else {
          if (!cancelled) setSrc(null);
        }
      } catch {
        if (!cancelled) setSrc(legacyImageUrl ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
      if (normalizedObjectUrl) URL.revokeObjectURL(normalizedObjectUrl);
    };
  }, [originalImageUrl, cropBbox, legacyImageUrl]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-[#F5E6D3] ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-[#F5E6D3] text-xs text-[#8D6E63] ${className}`}>
        无图片
      </div>
    );
  }

  const img = <img src={src} alt={alt} className={className} draggable={false} />;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {img}
      </button>
    );
  }

  return img;
}

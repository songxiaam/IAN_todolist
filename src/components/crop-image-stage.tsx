'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { NormalizedBBox } from '@/lib/image-crop-types';

interface CropImageStageProps {
  imageUrl: string;
  imageRef?: RefObject<HTMLImageElement | null>;
  onImageLoad?: () => void;
  bordered?: boolean;
  children?: ReactNode;
}

function getNormalizedPoint(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
): { nx: number; ny: number; rect: DOMRect } {
  const rect = img.getBoundingClientRect();
  return {
    nx: (clientX - rect.left) / rect.width,
    ny: (clientY - rect.top) / rect.height,
    rect,
  };
}

function clientToLocal(clientX: number, clientY: number, rect: DOMRect) {
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function bboxToOverlayStyle(b: NormalizedBBox): CSSProperties {
  return {
    left: `${b.x * 100}%`,
    top: `${b.y * 100}%`,
    width: `${b.w * 100}%`,
    height: `${b.h * 100}%`,
  };
}

export function CropImageStage({
  imageUrl,
  imageRef,
  onImageLoad,
  bordered = true,
  children,
}: CropImageStageProps) {
  const internalRef = useRef<HTMLImageElement>(null);
  const imgRef = imageRef ?? internalRef;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [imageUrl]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
      onImageLoad?.();
    }
  }, [imageUrl, imgRef, onImageLoad]);

  const handleLoad = () => {
    setLoaded(true);
    onImageLoad?.();
  };

  const stage = (
    <div className="relative w-full">
      <img
        ref={imgRef}
        src={imageUrl}
        alt=""
        className="block h-auto w-full"
        draggable={false}
        onLoad={handleLoad}
      />
      {loaded && children && (
        <div className="absolute inset-0">{children}</div>
      )}
    </div>
  );

  if (bordered) {
    return (
      <div className="mx-auto w-full max-w-full overflow-hidden rounded-lg sketchy-border">
        {stage}
      </div>
    );
  }

  return <div className="mx-auto w-full max-w-full">{stage}</div>;
}

export { getNormalizedPoint, clientToLocal };

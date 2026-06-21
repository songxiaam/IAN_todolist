'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NormalizedBBox } from '@/lib/image-crop-types';
import { DEFAULT_MANUAL_BBOX } from '@/lib/image-crop-types';
import { cropImageToObjectUrl, normalizeImageFile } from '@/lib/crop-preview';
import type { CropRegionItem } from '@/components/crop-regions-overview';

type CropView = 'overview' | 'editor';

function newRegionId() {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface UseCropRegionsSessionOptions {
  onNavTitle?: (title: string | null, onBack: (() => void) | null) => void;
}

export function useCropRegionsSession({ onNavTitle }: UseCropRegionsSessionOptions = {}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [regions, setRegions] = useState<CropRegionItem[]>([]);
  const [view, setView] = useState<CropView>('overview');
  const [editingIndex, setEditingIndex] = useState<number | 'new' | null>(null);
  const [detecting, setDetecting] = useState(false);
  const previewUrlsRef = useRef<string[]>([]);

  const revokePreviews = useCallback(() => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
  }, []);

  const cancelSession = useCallback(() => {
    revokePreviews();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setImageFile(null);
    setRegions([]);
    setView('overview');
    setEditingIndex(null);
    setDetecting(false);
  }, [imageUrl, revokePreviews]);

  const refreshPreviews = useCallback(async (url: string, items: CropRegionItem[]) => {
    revokePreviews();
    const next = await Promise.all(
      items.map(async (item) => {
        try {
          const previewUrl = await cropImageToObjectUrl(url, item.bbox);
          previewUrlsRef.current.push(previewUrl);
          return { ...item, previewUrl };
        } catch {
          return item;
        }
      }),
    );
    setRegions(next);
  }, [revokePreviews]);

  const startSession = useCallback(
    async (file: File, token: string, initialRegions?: NormalizedBBox[]) => {
      cancelSession();

      const { file: normalizedFile, url } = await normalizeImageFile(file);
      setImageUrl(url);
      setImageFile(normalizedFile);
      setDetecting(true);

      let bboxes = initialRegions;
      if (!bboxes) {
        const formData = new FormData();
        formData.append('image', normalizedFile);
        const res = await fetch('/api/detect-regions', {
          method: 'POST',
          headers: { 'x-session': token },
          body: formData,
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.regions) && data.regions.length > 0) {
          bboxes = data.regions as NormalizedBBox[];
        } else {
          bboxes = [DEFAULT_MANUAL_BBOX];
        }
      }

      const items: CropRegionItem[] = bboxes.map((bbox, i) => ({
        id: newRegionId(),
        bbox,
        label: String(i + 1),
      }));

      setDetecting(false);
      await refreshPreviews(url, items);
    },
    [cancelSession, refreshPreviews],
  );

  const openEditor = useCallback((index: number | 'new') => {
    setEditingIndex(index);
    setView('editor');
  }, []);

  const closeEditor = useCallback(() => {
    setEditingIndex(null);
    setView('overview');
  }, []);

  const confirmEditor = useCallback(
    async (bbox: NormalizedBBox) => {
      if (!imageUrl) return;

      let next: CropRegionItem[];
      if (editingIndex === 'new') {
        next = [
          ...regions,
          { id: newRegionId(), bbox, label: String(regions.length + 1) },
        ];
      } else if (typeof editingIndex === 'number') {
        next = regions.map((r, i) =>
          i === editingIndex ? { ...r, bbox } : r,
        );
      } else {
        return;
      }

      next = next.map((r, i) => ({ ...r, label: String(i + 1) }));
      await refreshPreviews(imageUrl, next);
      closeEditor();
    },
    [imageUrl, regions, editingIndex, refreshPreviews, closeEditor],
  );

  const deleteFromEditor = useCallback(async () => {
    if (!imageUrl || typeof editingIndex !== 'number') return;
    const next = regions
      .filter((_, i) => i !== editingIndex)
      .map((r, i) => ({ ...r, label: String(i + 1) }));
    await refreshPreviews(imageUrl, next);
    closeEditor();
  }, [imageUrl, regions, editingIndex, refreshPreviews, closeEditor]);

  const deleteRegion = useCallback(
    async (index: number) => {
      if (!imageUrl) return;
      const next = regions
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, label: String(i + 1) }));
      await refreshPreviews(imageUrl, next);
    },
    [imageUrl, regions, refreshPreviews],
  );

  const getEditorProps = useCallback(() => {
    if (editingIndex === 'new') {
      return { initialBBox: DEFAULT_MANUAL_BBOX, isNew: true, regionLabel: '新题目' };
    }
    if (typeof editingIndex === 'number') {
      const region = regions[editingIndex];
      return {
        initialBBox: region?.bbox ?? DEFAULT_MANUAL_BBOX,
        isNew: false,
        regionLabel: `第 ${editingIndex + 1} 题`,
      };
    }
    return null;
  }, [editingIndex, regions]);

  useEffect(() => {
    if (!onNavTitle) return;

    if (!imageUrl) {
      onNavTitle(null, null);
      return;
    }

    if (view === 'editor') {
      onNavTitle('编辑选区', closeEditor);
    } else if (detecting) {
      onNavTitle('识别题目', cancelSession);
    } else {
      onNavTitle('框选题目', cancelSession);
    }
  }, [imageUrl, view, detecting, onNavTitle, closeEditor, cancelSession]);

  useEffect(() => () => {
    revokePreviews();
  }, [revokePreviews]);

  return {
    imageUrl,
    imageFile,
    regions,
    view,
    editingIndex,
    detecting,
    active: Boolean(imageUrl),
    startSession,
    cancelSession,
    openEditor,
    closeEditor,
    confirmEditor,
    deleteFromEditor,
    deleteRegion,
    getEditorProps,
    getRegionBboxes: () => regions.map((r) => r.bbox),
  };
}

export type CropRegionsSession = ReturnType<typeof useCropRegionsSession>;

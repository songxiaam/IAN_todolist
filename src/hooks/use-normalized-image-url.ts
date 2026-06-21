'use client';

import { useEffect, useState } from 'react';
import { normalizeImageUrl } from '@/lib/crop-preview';

export function useNormalizedImageUrl(sourceUrl: string | null | undefined) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sourceUrl) {
      setDisplayUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const normalized = await normalizeImageUrl(sourceUrl);
      if (cancelled) {
        if (normalized !== sourceUrl) URL.revokeObjectURL(normalized);
        return;
      }
      objectUrl = normalized !== sourceUrl ? normalized : null;
      setDisplayUrl(normalized);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceUrl]);

  return { displayUrl: displayUrl ?? sourceUrl ?? null, loading };
}

'use client';

import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export interface NavOverride {
  title: string;
  onBack: () => void;
}

interface NavigationBarProps {
  title: string;
  subtitle?: string;
  navOverride?: NavOverride | null;
  rightAction?: ReactNode;
}

export function NavigationBar({ title, subtitle, navOverride, rightAction }: NavigationBarProps) {
  const showBack = Boolean(navOverride);
  const displayTitle = navOverride?.title ?? title;
  const displaySubtitle = navOverride ? undefined : subtitle;

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#5D4037] bg-[#F5E6D3]/95 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2.5">
        <div className="flex w-10 shrink-0 items-center justify-start">
          {showBack ? (
            <button
              type="button"
              onClick={navOverride!.onBack}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#D7CCC8] text-[#5D4037] active:bg-[#FFFDE7]"
              aria-label="返回"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 text-center">
          <h1
            className="truncate text-base text-[#5D4037]"
            style={{ fontFamily: "'Patrick Hand', cursive" }}
          >
            {displayTitle}
          </h1>
          {displaySubtitle && (
            <p className="truncate text-xs text-[#8D6E63]">{displaySubtitle}</p>
          )}
        </div>

        <div className="flex w-10 shrink-0 items-center justify-end">{rightAction ?? null}</div>
      </div>
    </header>
  );
}

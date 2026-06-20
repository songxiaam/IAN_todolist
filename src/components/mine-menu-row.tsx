'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';

interface MineMenuRowProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
}

export function MineMenuRow({ icon: Icon, label, hint, onClick }: MineMenuRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sketchy-card flex w-full items-center gap-3 p-4 text-left active:bg-[#F5E6D3]/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7CB342]/15 text-[#7CB342]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          {label}
        </p>
        {hint && <p className="text-xs text-[#8D6E63]">{hint}</p>}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#8D6E63]" />
    </button>
  );
}

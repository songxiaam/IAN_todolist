'use client';

import { BookOpen, ClipboardCheck, BookMarked, User, Plus } from 'lucide-react';

export type MobileTabId = 'homework' | 'grading' | 'wrong' | 'mine';

interface MobileTabBarProps {
  activeTab: MobileTabId;
  onTabChange: (tab: MobileTabId) => void;
  onCaptureClick?: () => void;
}

const LEFT_TABS: { id: MobileTabId; label: string; icon: typeof BookOpen }[] = [
  { id: 'homework', label: '作业', icon: BookOpen },
  { id: 'wrong', label: '错题集', icon: BookMarked },
];

const RIGHT_TABS: { id: MobileTabId; label: string; icon: typeof BookOpen }[] = [
  { id: 'grading', label: '批改', icon: ClipboardCheck },
  { id: 'mine', label: '我的', icon: User },
];

function TabButton({
  tab,
  active,
  onTabChange,
}: {
  tab: (typeof LEFT_TABS)[number];
  active: boolean;
  onTabChange: (tab: MobileTabId) => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={() => onTabChange(tab.id)}
      className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 transition-all active:scale-95 ${
        active ? 'text-[#7CB342]' : 'text-[#8D6E63]'
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
          active ? 'bg-[#7CB342]/20' : 'bg-transparent'
        }`}
      >
        <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5px]' : ''}`} />
      </span>
      <span
        className={`text-[11px] leading-none ${active ? 'font-semibold' : ''}`}
        style={{ fontFamily: "'Patrick Hand', cursive" }}
      >
        {tab.label}
      </span>
    </button>
  );
}

export function MobileTabBar({ activeTab, onTabChange, onCaptureClick }: MobileTabBarProps) {
  return (
    <nav
      className="mobile-tab-bar fixed bottom-0 inset-x-0 z-50 border-t-2 border-[#5D4037] bg-[#FFFDE7]/95 backdrop-blur-md"
      aria-label="主导航"
    >
      <div className="mx-auto flex max-w-lg items-end px-1 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 items-stretch justify-around">
          {LEFT_TABS.map((tab) => (
            <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onTabChange={onTabChange} />
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-center px-2 -mt-5">
          <button
            type="button"
            onClick={onCaptureClick}
            className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#5D4037] crayon-button text-[#FFFDE7] shadow-lg transition-transform active:scale-95"
            aria-label="拍照"
          >
            <Plus className="h-7 w-7 stroke-[2.5px]" />
          </button>
        </div>

        <div className="flex flex-1 items-stretch justify-around">
          {RIGHT_TABS.map((tab) => (
            <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onTabChange={onTabChange} />
          ))}
        </div>
      </div>
    </nav>
  );
}

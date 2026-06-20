'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Gift, Users, Settings } from 'lucide-react';
import { APP_ICON } from '@/lib/constants';
import type { NavOverride } from '@/components/navigation-bar';
import { MineMenuRow } from '@/components/mine-menu-row';
import { MineSettingsPage } from '@/components/mine-settings-page';
import { MineGiftsPage } from '@/components/mine-gifts-page';
import { MineFamilyPage } from '@/components/mine-family-page';

export type MineSubScreen = 'hub' | 'settings' | 'gifts' | 'family';

const SUB_TITLES: Record<Exclude<MineSubScreen, 'hub'>, string> = {
  settings: '设置',
  gifts: '礼品列表',
  family: '家庭成员',
};

interface MinePanelProps {
  role: 'parent' | 'student';
  name: string;
  familyId: string;
  familyMembers: { id: string; name: string; role: string; username?: string | null }[];
  pointsBalance: number;
  username?: string | null;
  copiedFamilyCode: boolean;
  onCopyFamilyCode: () => void;
  onCreateStudent: () => void;
  onLogout: () => void;
  onPointsChange?: (balance: number) => void;
  onNavOverride?: (nav: NavOverride | null) => void;
}

export function MinePanel({
  role,
  name,
  familyId,
  familyMembers,
  pointsBalance,
  username,
  copiedFamilyCode,
  onCopyFamilyCode,
  onCreateStudent,
  onLogout,
  onPointsChange,
  onNavOverride,
}: MinePanelProps) {
  const [subScreen, setSubScreen] = useState<MineSubScreen>('hub');

  useEffect(() => {
    if (subScreen === 'hub') {
      onNavOverride?.(null);
    } else {
      onNavOverride?.({
        title: SUB_TITLES[subScreen],
        onBack: () => setSubScreen('hub'),
      });
    }
  }, [subScreen, onNavOverride]);

  if (subScreen === 'settings') {
    return (
      <MineSettingsPage
        role={role}
        name={name}
        familyId={familyId}
        pointsBalance={pointsBalance}
        username={username}
        onLogout={onLogout}
      />
    );
  }

  if (subScreen === 'gifts') {
    return (
      <MineGiftsPage
        role={role}
        familyMembers={familyMembers}
        onPointsChange={onPointsChange}
      />
    );
  }

  if (subScreen === 'family') {
    return (
      <MineFamilyPage
        familyId={familyId}
        familyMembers={familyMembers}
        copiedFamilyCode={copiedFamilyCode}
        onCopyFamilyCode={onCopyFamilyCode}
        onCreateStudent={onCreateStudent}
      />
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="sketchy-card flex items-center gap-4 p-4">
        <div className="h-14 w-14 shrink-0 rotate-2 overflow-hidden rounded-full border-2 border-[#5D4037]">
          <Image src={APP_ICON} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            {name}
          </p>
          <p className="text-sm text-[#8D6E63]">{role === 'parent' ? '👨‍👩‍👧 家长' : '🎒 学生'}</p>
          {role === 'student' && (
            <p className="mt-1 text-sm text-[#FFB74D]">🌟 {pointsBalance} 积分</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <MineMenuRow
          icon={Gift}
          label="礼品列表"
          hint={role === 'student' ? '积分兑换与礼券' : '管理礼品与核销'}
          onClick={() => setSubScreen('gifts')}
        />

        {role === 'parent' && (
          <MineMenuRow
            icon={Users}
            label="家庭成员"
            hint={`${familyMembers.length} 位成员`}
            onClick={() => setSubScreen('family')}
          />
        )}

        <MineMenuRow icon={Settings} label="设置" hint="个人信息与账号" onClick={() => setSubScreen('settings')} />
      </div>
    </div>
  );
}

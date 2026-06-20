'use client';

import { Copy, Check, UserPlus } from 'lucide-react';

interface MineFamilyPageProps {
  familyId: string;
  familyMembers: { id: string; name: string; role: string; username?: string | null }[];
  copiedFamilyCode: boolean;
  onCopyFamilyCode: () => void;
  onCreateStudent: () => void;
}

export function MineFamilyPage({
  familyId,
  familyMembers,
  copiedFamilyCode,
  onCopyFamilyCode,
  onCreateStudent,
}: MineFamilyPageProps) {
  const students = familyMembers.filter((m) => m.role === 'student');

  return (
    <div className="space-y-4 pb-4">
      <div className="sketchy-card bg-[#7CB342]/10 p-4">
        <h3 className="mb-2 text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          邀请其他家长
        </h3>
        <p className="mb-3 text-sm text-[#8D6E63]">
          将家庭码发给另一位家长，注册后选择「家长 → 加入已有家庭」
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-lg border-2 border-[#D7CCC8] bg-[#FFFDE7] px-3 py-2 text-sm text-[#5D4037]">
            {familyId}
          </code>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 px-3 py-2 text-sm crayon-button text-[#FFFDE7]"
            onClick={onCopyFamilyCode}
          >
            {copiedFamilyCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="sketchy-card bg-[#F5E6D3]/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            成员列表 ({familyMembers.length})
          </h3>
          <button
            type="button"
            className="flex items-center gap-1 px-3 py-1.5 text-sm crayon-button text-[#FFFDE7]"
            onClick={onCreateStudent}
          >
            <UserPlus className="h-4 w-4" />
            添加学生
          </button>
        </div>
        <div className="space-y-2">
          {familyMembers.map((member, idx) => (
            <div
              key={member.id}
              className={`flex items-center gap-3 rounded-lg border-2 border-[#D7CCC8] bg-[#FFFDE7] px-4 py-3 ${idx % 2 === 0 ? '-rotate-[0.5deg]' : 'rotate-[0.5deg]'}`}
              style={{ fontFamily: "'Patrick Hand', cursive" }}
            >
              <span className="text-xl">{member.role === 'parent' ? '👨‍👩‍👧' : '🎒'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[#5D4037]">{member.name}</p>
                <p className="text-xs text-[#8D6E63]">
                  {member.role === 'parent' ? '家长' : '学生'}
                  {member.username && ` · @${member.username}`}
                </p>
              </div>
            </div>
          ))}
        </div>
        {students.length === 0 && (
          <p className="mt-3 text-center text-sm text-[#8D6E63]">请先创建学生账号</p>
        )}
      </div>
    </div>
  );
}

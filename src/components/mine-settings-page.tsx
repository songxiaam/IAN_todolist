'use client';

import { useCallback, useEffect, useState } from 'react';
import { User, KeyRound, LogOut, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MineMenuRow } from '@/components/mine-menu-row';

interface MineSettingsPageProps {
  role: 'parent' | 'student';
  name: string;
  familyId: string;
  pointsBalance: number;
  username?: string | null;
  onLogout: () => void;
}

export function MineSettingsPage({
  role,
  name,
  familyId,
  pointsBalance,
  username,
  onLogout,
}: MineSettingsPageProps) {
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [hasWriteoffPassword, setHasWriteoffPassword] = useState(false);
  const [newWriteoffPassword, setNewWriteoffPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(role === 'parent');

  const getToken = async () => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    return (await supabase.auth.getSession()).data.session?.access_token ?? '';
  };

  const loadSettings = useCallback(async () => {
    if (role !== 'parent') return;
    const token = await getToken();
    const res = await fetch('/api/family/settings', { headers: { 'x-session': token } });
    const settings = await res.json();
    setHasWriteoffPassword(Boolean(settings.hasWriteoffPassword));
    setLoadingSettings(false);
  }, [role]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSaveWriteoffPassword = async () => {
    if (newWriteoffPassword.length < 4) {
      alert('密码至少 4 位');
      return;
    }
    setSavingPassword(true);
    const token = await getToken();
    const res = await fetch('/api/family/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ writeoff_password: newWriteoffPassword }),
    });
    setSavingPassword(false);
    if (res.ok) {
      setNewWriteoffPassword('');
      setHasWriteoffPassword(true);
      setShowPasswordDialog(false);
      alert('核销密码已设置');
    } else {
      const data = await res.json();
      alert(data.error || '设置失败');
    }
  };

  return (
    <div className="space-y-2 pb-4">
      <MineMenuRow icon={User} label="个人信息" hint="查看账号资料" onClick={() => setShowProfileDialog(true)} />

      {role === 'parent' && (
        <MineMenuRow
          icon={KeyRound}
          label="核销密码"
          hint={hasWriteoffPassword ? '已设置，点击修改' : '未设置，点击配置'}
          onClick={() => setShowPasswordDialog(true)}
        />
      )}

      <MineMenuRow icon={LogOut} label="退出登录" onClick={() => setShowLogoutDialog(true)} />

      {loadingSettings && role === 'parent' && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-[#7CB342]" />
        </div>
      )}

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-2 border-[#5D4037] bg-[#FFFDE7]">
          <DialogHeader>
            <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              个人信息
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-dashed border-[#D7CCC8] py-2">
              <span className="text-[#8D6E63]">姓名</span>
              <span className="text-[#5D4037]">{name}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-dashed border-[#D7CCC8] py-2">
              <span className="text-[#8D6E63]">身份</span>
              <span className="text-[#5D4037]">{role === 'parent' ? '家长' : '学生'}</span>
            </div>
            {username && (
              <div className="flex justify-between gap-4 border-b border-dashed border-[#D7CCC8] py-2">
                <span className="text-[#8D6E63]">用户名</span>
                <span className="text-[#5D4037]">@{username}</span>
              </div>
            )}
            {role === 'student' && (
              <div className="flex justify-between gap-4 border-b border-dashed border-[#D7CCC8] py-2">
                <span className="text-[#8D6E63]">积分</span>
                <span className="text-[#FFB74D]">🌟 {pointsBalance}</span>
              </div>
            )}
            {role === 'parent' && (
              <div className="py-2">
                <span className="text-[#8D6E63]">家庭码</span>
                <p className="mt-1 break-all rounded-lg border border-[#D7CCC8] bg-[#F5E6D3]/50 px-2 py-1.5 text-xs text-[#5D4037]">
                  {familyId}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            className="mt-2 w-full py-2.5 crayon-button text-[#FFFDE7]"
            onClick={() => setShowProfileDialog(false)}
          >
            知道了
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-2 border-[#5D4037] bg-[#FFFDE7]">
          <DialogHeader>
            <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              核销密码
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-xs text-[#8D6E63]">
            学生兑换礼券后，使用时需输入此密码核销
          </p>
          <input
            type="password"
            placeholder={hasWriteoffPassword ? '输入新密码（至少4位）' : '设置密码（至少4位）'}
            value={newWriteoffPassword}
            onChange={(e) => setNewWriteoffPassword(e.target.value)}
            className="w-full pencil-input px-3 py-2.5"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border-2 border-[#D7CCC8] py-2.5 text-sm text-[#8D6E63]"
              onClick={() => setShowPasswordDialog(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="flex-1 py-2.5 crayon-button text-sm text-[#FFFDE7] disabled:opacity-50"
              disabled={savingPassword || newWriteoffPassword.length < 4}
              onClick={handleSaveWriteoffPassword}
            >
              {savingPassword ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : '保存'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-2 border-[#5D4037] bg-[#FFFDE7]">
          <DialogHeader>
            <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              确认退出？
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-[#8D6E63]">确定要退出登录吗？</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border-2 border-[#D7CCC8] py-2.5 text-sm text-[#8D6E63]"
              onClick={() => setShowLogoutDialog(false)}
            >
              留下
            </button>
            <button
              type="button"
              className="flex-1 py-2.5 crayon-button-orange text-sm text-[#5D4037]"
              onClick={() => {
                setShowLogoutDialog(false);
                onLogout();
              }}
            >
              退出
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

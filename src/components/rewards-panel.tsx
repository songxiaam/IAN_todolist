'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Ticket, Loader2, Check, X } from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';

interface GiftItem {
  id: number;
  name: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
}

interface VoucherItem {
  id: number;
  code: string;
  status: string;
  points_spent: number;
  gifts: { name: string; description: string | null };
  student_id?: string;
}

interface RewardsPanelProps {
  role: 'parent' | 'student';
  familyMembers: { id: string; name: string; role: string }[];
  onPointsChange?: (balance: number) => void;
}

export function RewardsPanel({ role, familyMembers, onPointsChange }: RewardsPanelProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [giftName, setGiftName] = useState('');
  const [giftDesc, setGiftDesc] = useState('');
  const [giftPoints, setGiftPoints] = useState(50);
  const [writeoffPassword, setWriteoffPassword] = useState('');
  const [newWriteoffPassword, setNewWriteoffPassword] = useState('');
  const [hasWriteoffPassword, setHasWriteoffPassword] = useState(false);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [writeoffVoucherId, setWriteoffVoucherId] = useState<number | null>(null);
  const [writeoffInput, setWriteoffInput] = useState('');
  const [pointsBalance, setPointsBalance] = useState(0);

  const getToken = async () => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    return (await supabase.auth.getSession()).data.session?.access_token ?? '';
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const [giftsRes, vouchersRes, profileRes] = await Promise.all([
      fetch('/api/gifts', { headers: { 'x-session': token } }),
      fetch('/api/vouchers', { headers: { 'x-session': token } }),
      fetch('/api/profile', { headers: { 'x-session': token } }),
    ]);

    const giftsData = await giftsRes.json();
    const vouchersData = await vouchersRes.json();
    const profileData = await profileRes.json();

    if (Array.isArray(giftsData)) setGifts(giftsData);
    if (Array.isArray(vouchersData)) setVouchers(vouchersData);
    if (profileData.points_balance !== undefined) {
      setPointsBalance(profileData.points_balance);
      onPointsChange?.(profileData.points_balance);
    }

    if (role === 'parent') {
      const settingsRes = await fetch('/api/family/settings', { headers: { 'x-session': token } });
      const settings = await settingsRes.json();
      setHasWriteoffPassword(Boolean(settings.hasWriteoffPassword));
    }

    setLoading(false);
  }, [role, onPointsChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddGift = async () => {
    const token = await getToken();
    const res = await fetch('/api/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ name: giftName, description: giftDesc, points_cost: giftPoints }),
    });
    if (res.ok) {
      setGiftName('');
      setGiftDesc('');
      setGiftPoints(50);
      loadData();
    } else {
      const data = await res.json();
      alert(data.error || '添加失败');
    }
  };

  const handleRedeem = async (giftId: number) => {
    setRedeemingId(giftId);
    const token = await getToken();
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ gift_id: giftId }),
    });
    const data = await res.json();
    setRedeemingId(null);
    if (res.ok) {
      setPointsBalance(data.pointsBalance);
      onPointsChange?.(data.pointsBalance);
      loadData();
      alert(`兑换成功！礼券码：${data.voucher.code}`);
    } else {
      alert(data.error || '兑换失败');
    }
  };

  const handleWriteoff = async (voucherId: number) => {
    const token = await getToken();
    const res = await fetch('/api/vouchers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ voucher_id: voucherId, writeoff_password: writeoffInput }),
    });
    const data = await res.json();
    if (res.ok) {
      setWriteoffVoucherId(null);
      setWriteoffInput('');
      loadData();
      alert('核销成功！');
    } else {
      alert(data.error || '核销失败');
    }
  };

  const handleSaveWriteoffPassword = async () => {
    const token = await getToken();
    const res = await fetch('/api/family/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ writeoff_password: newWriteoffPassword }),
    });
    if (res.ok) {
      setNewWriteoffPassword('');
      setHasWriteoffPassword(true);
      alert('核销密码已设置');
    } else {
      const data = await res.json();
      alert(data.error || '设置失败');
    }
  };

  const getStudentName = (id: string) =>
    familyMembers.find((m) => m.id === id)?.name ?? '学生';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {role === 'student' && (
        <div className="sketchy-card p-4 text-center bg-[#FFB74D]/20">
          <p className="text-sm text-[#8D6E63]">我的积分</p>
          <p className="text-4xl text-[#5D4037] mt-1" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            🌟 {pointsBalance}
          </p>
        </div>
      )}

      {role === 'parent' && (
        <>
          <div className="sketchy-card p-4 bg-[#F5E6D3]/50">
            <h3 className="text-[#5D4037] mb-3" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              🔐 核销密码设置
            </h3>
            <p className="text-xs text-[#8D6E63] mb-2">
              学生兑换礼券后，使用时需您输入此密码核销
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={hasWriteoffPassword ? '设置新密码...' : '设置核销密码（至少4位）'}
                value={newWriteoffPassword}
                onChange={(e) => setNewWriteoffPassword(e.target.value)}
                className="flex-1 py-2 px-3 pencil-input"
              />
              <button className="px-4 py-2 crayon-button text-[#FFFDE7] text-sm" onClick={handleSaveWriteoffPassword}>
                保存
              </button>
            </div>
          </div>

          <div className="sketchy-card p-4">
            <h3 className="text-[#5D4037] mb-3 flex items-center gap-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              <Gift className="w-5 h-5" /> 添加礼品
            </h3>
            <div className="space-y-2">
              <input placeholder="礼品名称" value={giftName} onChange={(e) => setGiftName(e.target.value)} className="w-full py-2 px-3 pencil-input" />
              <input placeholder="描述（可选）" value={giftDesc} onChange={(e) => setGiftDesc(e.target.value)} className="w-full py-2 px-3 pencil-input" />
              <input type="number" placeholder="所需积分" value={giftPoints} onChange={(e) => setGiftPoints(parseInt(e.target.value) || 0)} className="w-full py-2 px-3 pencil-input" />
              <button className="w-full py-2 crayon-button text-[#FFFDE7]" onClick={handleAddGift} disabled={!giftName || giftPoints <= 0}>
                添加礼品
              </button>
            </div>
          </div>
        </>
      )}

      <div className="sketchy-card p-4">
        <h3 className="text-[#5D4037] mb-3" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          🎁 礼品{role === 'student' ? '兑换' : '列表'}
        </h3>
        {gifts.length === 0 ? (
          <p className="text-sm text-[#8D6E63] text-center py-4">暂无礼品</p>
        ) : (
          <div className="space-y-2">
            {gifts.map((g) => (
              <div key={g.id} className="flex items-center justify-between p-3 border-2 border-[#D7CCC8] rounded-lg bg-[#FFFDE7]">
                <div>
                  <p className="text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>{g.name}</p>
                  {g.description && <p className="text-xs text-[#8D6E63]">{g.description}</p>}
                  <p className="text-sm text-[#FFB74D] mt-1">{g.points_cost} 积分</p>
                </div>
                {role === 'student' && (
                  <button
                    className="px-3 py-2 crayon-button text-[#FFFDE7] text-sm disabled:opacity-50"
                    onClick={() => handleRedeem(g.id)}
                    disabled={redeemingId === g.id || pointsBalance < g.points_cost}
                  >
                    {redeemingId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : '兑换'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sketchy-card p-4">
        <h3 className="text-[#5D4037] mb-3 flex items-center gap-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          <Ticket className="w-5 h-5" /> {role === 'student' ? '我的礼券' : '礼券核销'}
        </h3>
        {vouchers.length === 0 ? (
          <p className="text-sm text-[#8D6E63] text-center py-4">暂无礼券</p>
        ) : (
          <div className="space-y-2">
            {vouchers.map((v) => (
              <div key={v.id} className={`p-3 border-2 rounded-lg ${v.status === 'active' ? 'border-[#7CB342] bg-[#7CB342]/10' : 'border-[#D7CCC8] bg-[#F5E6D3]/30'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-lg text-[#5D4037]">{v.code}</p>
                    <p className="text-sm text-[#5D4037]">{v.gifts?.name}</p>
                    {role === 'parent' && v.student_id && (
                      <p className="text-xs text-[#8D6E63]">学生：{getStudentName(v.student_id)}</p>
                    )}
                    <p className="text-xs text-[#8D6E63] mt-1">
                      {v.status === 'active' ? '✅ 待使用' : '已核销'}
                    </p>
                  </div>
                  {role === 'parent' && v.status === 'active' && (
                    writeoffVoucherId === v.id ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="password"
                          placeholder="核销密码"
                          value={writeoffInput}
                          onChange={(e) => setWriteoffInput(e.target.value)}
                          className="w-28 py-1 px-2 pencil-input text-sm"
                        />
                        <div className="flex gap-1">
                          <button className="p-1 text-[#7CB342]" onClick={() => handleWriteoff(v.id)}><Check className="w-4 h-4" /></button>
                          <button className="p-1 text-[#EF5350]" onClick={() => setWriteoffVoucherId(null)}><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ) : (
                      <button className="px-2 py-1 text-sm crayon-button-orange text-[#5D4037]" onClick={() => setWriteoffVoucherId(v.id)}>
                        核销
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

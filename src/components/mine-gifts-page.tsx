'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Ticket, Loader2, Check, X, Plus } from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

interface MineGiftsPageProps {
  role: 'parent' | 'student';
  familyMembers: { id: string; name: string; role: string }[];
  onPointsChange?: (balance: number) => void;
}

export function MineGiftsPage({ role, familyMembers, onPointsChange }: MineGiftsPageProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [giftName, setGiftName] = useState('');
  const [giftDesc, setGiftDesc] = useState('');
  const [giftPoints, setGiftPoints] = useState(50);
  const [adding, setAdding] = useState(false);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [writeoffVoucherId, setWriteoffVoucherId] = useState<number | null>(null);
  const [writeoffInput, setWriteoffInput] = useState('');

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
    setLoading(false);
  }, [onPointsChange]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddGift = async () => {
    setAdding(true);
    const token = await getToken();
    const res = await fetch('/api/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ name: giftName, description: giftDesc, points_cost: giftPoints }),
    });
    setAdding(false);
    if (res.ok) {
      setGiftName('');
      setGiftDesc('');
      setGiftPoints(50);
      setShowAddDialog(false);
      void loadData();
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
      void loadData();
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
      void loadData();
      alert('核销成功！');
    } else {
      alert(data.error || '核销失败');
    }
  };

  const getStudentName = (id: string) =>
    familyMembers.find((m) => m.id === id)?.name ?? '学生';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {role === 'student' && (
        <div className="sketchy-card bg-[#FFB74D]/20 p-4 text-center">
          <p className="text-sm text-[#8D6E63]">我的积分</p>
          <p className="mt-1 text-3xl text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            🌟 {pointsBalance}
          </p>
        </div>
      )}

      {role === 'parent' && (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 py-2.5 crayon-button text-sm text-[#FFFDE7]"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-4 w-4" />
          添加礼品
        </button>
      )}

      <div className="sketchy-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          <Gift className="h-5 w-5" />
          {role === 'student' ? '可兑换礼品' : '礼品列表'}
        </h3>
        {gifts.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#8D6E63]">暂无礼品</p>
        ) : (
          <div className="space-y-2">
            {gifts.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-lg border-2 border-[#D7CCC8] bg-[#FFFDE7] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                    {g.name}
                  </p>
                  {g.description && <p className="text-xs text-[#8D6E63]">{g.description}</p>}
                  <p className="mt-1 text-sm text-[#FFB74D]">{g.points_cost} 积分</p>
                </div>
                {role === 'student' && (
                  <button
                    type="button"
                    className="shrink-0 px-3 py-2 text-sm crayon-button text-[#FFFDE7] disabled:opacity-50"
                    onClick={() => handleRedeem(g.id)}
                    disabled={redeemingId === g.id || pointsBalance < g.points_cost}
                  >
                    {redeemingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '兑换'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sketchy-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          <Ticket className="h-5 w-5" />
          {role === 'student' ? '我的礼券' : '礼券核销'}
        </h3>
        {vouchers.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#8D6E63]">暂无礼券</p>
        ) : (
          <div className="space-y-2">
            {vouchers.map((v) => (
              <div
                key={v.id}
                className={`rounded-lg border-2 p-3 ${v.status === 'active' ? 'border-[#7CB342] bg-[#7CB342]/10' : 'border-[#D7CCC8] bg-[#F5E6D3]/30'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-lg text-[#5D4037]">{v.code}</p>
                    <p className="text-sm text-[#5D4037]">{v.gifts?.name}</p>
                    {role === 'parent' && v.student_id && (
                      <p className="text-xs text-[#8D6E63]">学生：{getStudentName(v.student_id)}</p>
                    )}
                    <p className="mt-1 text-xs text-[#8D6E63]">
                      {v.status === 'active' ? '✅ 待使用' : '已核销'}
                    </p>
                  </div>
                  {role === 'parent' && v.status === 'active' && (
                    writeoffVoucherId === v.id ? (
                      <div className="flex shrink-0 flex-col gap-1">
                        <input
                          type="password"
                          placeholder="核销密码"
                          value={writeoffInput}
                          onChange={(e) => setWriteoffInput(e.target.value)}
                          className="w-28 pencil-input px-2 py-1 text-sm"
                        />
                        <div className="flex gap-1">
                          <button type="button" className="p-1 text-[#7CB342]" onClick={() => handleWriteoff(v.id)}>
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" className="p-1 text-[#EF5350]" onClick={() => setWriteoffVoucherId(null)}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 px-2 py-1 text-sm crayon-button-orange text-[#5D4037]"
                        onClick={() => setWriteoffVoucherId(v.id)}
                      >
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-2 border-[#5D4037] bg-[#FFFDE7]">
          <DialogHeader>
            <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              添加礼品
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              placeholder="礼品名称"
              value={giftName}
              onChange={(e) => setGiftName(e.target.value)}
              className="w-full pencil-input px-3 py-2.5"
            />
            <input
              placeholder="描述（可选）"
              value={giftDesc}
              onChange={(e) => setGiftDesc(e.target.value)}
              className="w-full pencil-input px-3 py-2.5"
            />
            <input
              type="number"
              placeholder="所需积分"
              value={giftPoints}
              onChange={(e) => setGiftPoints(parseInt(e.target.value) || 0)}
              className="w-full pencil-input px-3 py-2.5"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border-2 border-[#D7CCC8] py-2.5 text-sm text-[#8D6E63]"
              onClick={() => setShowAddDialog(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="flex-1 py-2.5 crayon-button text-sm text-[#FFFDE7] disabled:opacity-50"
              disabled={adding || !giftName || giftPoints <= 0}
              onClick={handleAddGift}
            >
              {adding ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : '添加'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

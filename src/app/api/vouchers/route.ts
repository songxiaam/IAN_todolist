import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { adjustPoints, generateVoucherCode } from '@/lib/points';
import { getAuthProfile, verifyParentSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const client = getSupabaseClient(auth.session);
  let query = client
    .from('vouchers')
    .select('*, gifts(name, description)')
    .eq('family_id', auth.profile.family_id)
    .order('created_at', { ascending: false });

  if (auth.profile.role === 'student') {
    query = query.eq('student_id', auth.userId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.profile.role !== 'student') {
    return NextResponse.json({ error: '只有学生可以兑换礼品' }, { status: 403 });
  }

  const body = await req.json();
  const { gift_id } = body;

  if (!gift_id) {
    return NextResponse.json({ error: '请选择礼品' }, { status: 400 });
  }

  const client = getSupabaseClient(auth.session);
  const { data: gift, error: giftError } = await client
    .from('gifts')
    .select('*')
    .eq('id', gift_id)
    .eq('family_id', auth.profile.family_id)
    .eq('is_active', true)
    .single();

  if (giftError || !gift) {
    return NextResponse.json({ error: '礼品不存在' }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();

  try {
    await adjustPoints(
      admin,
      auth.userId,
      -gift.points_cost,
      'gift_redeem',
      'gift',
      String(gift_id),
      `兑换礼品「${gift.name}」`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '积分不足';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: voucher, error: voucherError } = await admin
    .from('vouchers')
    .insert({
      gift_id: gift.id,
      student_id: auth.userId,
      family_id: auth.profile.family_id,
      code: generateVoucherCode(),
      status: 'active',
      points_spent: gift.points_cost,
    })
    .select('*, gifts(name, description)')
    .single();

  if (voucherError) {
    return NextResponse.json({ error: voucherError.message }, { status: 500 });
  }

  const { data: profile } = await client
    .from('profiles')
    .select('points_balance')
    .eq('id', auth.userId)
    .single();

  return NextResponse.json({ voucher, pointsBalance: profile?.points_balance ?? 0 });
}

export async function PATCH(req: NextRequest) {
  const parent = await verifyParentSession(req);
  if ('error' in parent) {
    return NextResponse.json({ error: parent.error }, { status: parent.status });
  }

  const body = await req.json();
  const { voucher_id, writeoff_password } = body;

  if (!voucher_id || !writeoff_password) {
    return NextResponse.json({ error: '请填写券号和核销密码' }, { status: 400 });
  }

  const client = getSupabaseClient(parent.session);
  const { data: family, error: familyError } = await client
    .from('families')
    .select('writeoff_salt, writeoff_password_hash')
    .eq('id', parent.profile.family_id)
    .single();

  if (familyError || !family?.writeoff_password_hash || !family.writeoff_salt) {
    return NextResponse.json({ error: '请先在设置中配置核销密码' }, { status: 400 });
  }

  const { verifyPassword } = await import('@/lib/password');
  if (!verifyPassword(writeoff_password, family.writeoff_salt, family.writeoff_password_hash)) {
    return NextResponse.json({ error: '核销密码错误' }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data: voucher, error: voucherError } = await admin
    .from('vouchers')
    .select('*')
    .eq('id', voucher_id)
    .eq('family_id', parent.profile.family_id)
    .eq('status', 'active')
    .single();

  if (voucherError || !voucher) {
    return NextResponse.json({ error: '礼券不存在或已核销' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from('vouchers')
    .update({
      status: 'redeemed',
      redeemed_at: now,
      redeemed_by: parent.profile.id,
    })
    .eq('id', voucher_id)
    .select('*, gifts(name, description)')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ voucher: updated });
}

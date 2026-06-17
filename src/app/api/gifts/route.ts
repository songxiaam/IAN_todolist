import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getAuthProfile } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const client = getSupabaseClient(auth.session);
  let query = client
    .from('gifts')
    .select('*')
    .eq('family_id', auth.profile.family_id)
    .order('points_cost', { ascending: true });

  if (auth.profile.role === 'student') {
    query = query.eq('is_active', true);
  } else {
    query = query.order('created_at', { ascending: false });
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

  if (auth.profile.role !== 'parent') {
    return NextResponse.json({ error: '只有家长可以管理礼品' }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, points_cost } = body;

  if (!name || !points_cost || points_cost <= 0) {
    return NextResponse.json({ error: '请填写礼品名称和有效积分' }, { status: 400 });
  }

  const client = getSupabaseClient(auth.session);
  const { data, error } = await client
    .from('gifts')
    .insert({
      family_id: auth.profile.family_id,
      name,
      description: description || null,
      points_cost,
      created_by: auth.profile.id,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

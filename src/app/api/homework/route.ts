import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-session');
  
  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  // 获取用户的 profile
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('family_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: '未找到用户资料' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let query = client
    .from('homeworks')
    .select(`
      *,
      profiles!homeworks_created_by_profiles_id_fk(name, role),
      assigned_profile:profiles!homeworks_assigned_to_profiles_id_fk(name, role)
    `)
    .eq('family_id', profile.family_id)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-session');
  
  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  // 获取用户的 profile
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('family_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: '未找到用户资料' }, { status: 404 });
  }

  if (profile.role !== 'parent') {
    return NextResponse.json({ error: '只有家长可以创建作业' }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, subject, deadline, estimated_minutes, assigned_to } = body;

  if (!title || !subject) {
    return NextResponse.json({ error: '缺少作业标题或科目' }, { status: 400 });
  }

  const { data, error } = await client
    .from('homeworks')
    .insert({
      title,
      description,
      subject,
      deadline,
      estimated_minutes: estimated_minutes || 30,
      family_id: profile.family_id,
      created_by: user.id,
      assigned_to,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = req.headers.get('x-session');

  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, started_at, completed_at } = body;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('family_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: '未找到用户资料' }, { status: 404 });
  }

  const { data: homework, error: homeworkError } = await client
    .from('homeworks')
    .select('id, family_id, assigned_to')
    .eq('id', parseInt(id))
    .eq('family_id', profile.family_id)
    .maybeSingle();

  if (homeworkError || !homework) {
    return NextResponse.json({ error: '作业不存在' }, { status: 404 });
  }

  if (profile.role === 'student' && homework.assigned_to !== user.id) {
    return NextResponse.json({ error: '这不是分配给您的作业' }, { status: 403 });
  }

  const updateData: Record<string, string | undefined> = {};
  if (status) updateData.status = status;
  if (started_at) updateData.started_at = started_at;
  if (completed_at) updateData.completed_at = completed_at;

  const { data, error } = await client
    .from('homeworks')
    .update(updateData)
    .eq('id', parseInt(id))
    .eq('family_id', profile.family_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = req.headers.get('x-session');

  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  const { id } = await params;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('family_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: '未找到用户资料' }, { status: 404 });
  }

  if (profile.role !== 'parent') {
    return NextResponse.json({ error: '只有家长可以删除作业' }, { status: 403 });
  }

  const { error } = await client
    .from('homeworks')
    .delete()
    .eq('id', parseInt(id))
    .eq('family_id', profile.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

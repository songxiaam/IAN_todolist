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
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: '未找到用户资料' }, { status: 404 });
  }

  // 获取家庭成员
  const { data, error } = await client
    .from('profiles')
    .select('id, name, role, username')
    .eq('family_id', profile.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
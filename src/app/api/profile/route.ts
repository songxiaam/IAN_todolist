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

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || { error: '未找到用户资料' });
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

  const body = await req.json();
  const { role, family_id, name } = body;

  if (!role || !family_id || !name) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  const { data, error } = await client
    .from('profiles')
    .insert({
      id: user.id,
      role,
      family_id,
      name,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
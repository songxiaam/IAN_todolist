import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';

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
  const { name } = body;

  if (!name) {
    return NextResponse.json({ error: '缺少家庭名称' }, { status: 400 });
  }

  const { data, error } = await client
    .from('families')
    .insert({ name, created_by: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
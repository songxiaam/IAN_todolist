import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';

const BUCKET = 'wrong-questions';

async function getWrongQuestion(
  client: ReturnType<typeof getSupabaseClient>,
  id: number,
  familyId: string,
) {
  const { data, error } = await client
    .from('wrong_questions')
    .select('*')
    .eq('id', id)
    .eq('family_id', familyId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const client = getSupabaseClient(auth.session);
  const record = await getWrongQuestion(client, parseInt(id, 10), auth.profile.family_id);

  if (!record) {
    return NextResponse.json({ error: '错题不存在' }, { status: 404 });
  }

  if (auth.profile.role === 'student' && record.student_id !== auth.userId) {
    return NextResponse.json({ error: '无权查看' }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(record.image_path);

  return NextResponse.json({ ...record, image_url: urlData.publicUrl });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await req.json();
  const client = getSupabaseClient(auth.session);
  const record = await getWrongQuestion(client, parseInt(id, 10), auth.profile.family_id);

  if (!record) {
    return NextResponse.json({ error: '错题不存在' }, { status: 404 });
  }

  if (auth.profile.role === 'student' && record.student_id !== auth.userId) {
    return NextResponse.json({ error: '无权操作' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.mastered === 'boolean') {
    updates.mastered = body.mastered;
  }
  if (body.action === 'review') {
    updates.review_count = (record.review_count ?? 0) + 1;
    updates.last_reviewed_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '无有效更新' }, { status: 400 });
  }

  const { data, error } = await client
    .from('wrong_questions')
    .update(updates)
    .eq('id', record.id)
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
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const client = getSupabaseClient(auth.session);
  const record = await getWrongQuestion(client, parseInt(id, 10), auth.profile.family_id);

  if (!record) {
    return NextResponse.json({ error: '错题不存在' }, { status: 404 });
  }

  if (auth.profile.role === 'student' && record.student_id !== auth.userId) {
    return NextResponse.json({ error: '无权删除' }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  await admin.storage.from(BUCKET).remove([record.image_path]);

  const { error } = await client.from('wrong_questions').delete().eq('id', record.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

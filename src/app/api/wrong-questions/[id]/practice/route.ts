import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getAuthProfile } from '@/lib/api-auth';
import { generateSimilarQuestions, isAiConfigured } from '@/lib/ai';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const wrongQuestionId = parseInt(id, 10);
  const client = getSupabaseClient(auth.session);

  const { data: record, error: recordError } = await client
    .from('wrong_questions')
    .select('student_id, family_id')
    .eq('id', wrongQuestionId)
    .eq('family_id', auth.profile.family_id)
    .maybeSingle();

  if (recordError || !record) {
    return NextResponse.json({ error: '错题不存在' }, { status: 404 });
  }

  if (auth.profile.role === 'student' && record.student_id !== auth.userId) {
    return NextResponse.json({ error: '无权查看' }, { status: 403 });
  }

  const { data, error } = await client
    .from('practice_questions')
    .select('*')
    .eq('wrong_question_id', wrongQuestionId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: '未配置 AI 接口' }, { status: 503 });
  }

  const { id } = await params;
  const wrongQuestionId = parseInt(id, 10);
  const client = getSupabaseClient(auth.session);

  const { data: record, error: recordError } = await client
    .from('wrong_questions')
    .select('*')
    .eq('id', wrongQuestionId)
    .eq('family_id', auth.profile.family_id)
    .maybeSingle();

  if (recordError || !record) {
    return NextResponse.json({ error: '错题不存在' }, { status: 404 });
  }

  if (auth.profile.role === 'student' && record.student_id !== auth.userId) {
    return NextResponse.json({ error: '无权操作' }, { status: 403 });
  }

  let generated;
  try {
    generated = await generateSimilarQuestions(record, 3);
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成练习题失败';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const rows = generated.map((q) => ({
    wrong_question_id: wrongQuestionId,
    question_text: q.question,
    question_type: q.question_type,
    options: q.options ? JSON.stringify(q.options) : null,
    answer: q.answer,
    explanation: q.explanation,
  }));

  const { data, error } = await client
    .from('practice_questions')
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await client
    .from('wrong_questions')
    .update({
      review_count: (record.review_count ?? 0) + 1,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq('id', wrongQuestionId);

  return NextResponse.json(data);
}

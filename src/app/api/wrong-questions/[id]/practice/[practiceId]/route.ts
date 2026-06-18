import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getAuthProfile } from '@/lib/api-auth';

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '').replace(/[。.，,、]/g, '');
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; practiceId: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, practiceId } = await params;
  const wrongQuestionId = parseInt(id, 10);
  const pid = parseInt(practiceId, 10);
  const body = await req.json();
  const { student_answer } = body as { student_answer?: string };

  if (!student_answer?.trim()) {
    return NextResponse.json({ error: '请填写答案' }, { status: 400 });
  }

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
    return NextResponse.json({ error: '无权操作' }, { status: 403 });
  }

  const { data: practice, error: practiceError } = await client
    .from('practice_questions')
    .select('*')
    .eq('id', pid)
    .eq('wrong_question_id', wrongQuestionId)
    .maybeSingle();

  if (practiceError || !practice) {
    return NextResponse.json({ error: '练习题不存在' }, { status: 404 });
  }

  const isCorrect =
    normalizeAnswer(student_answer) === normalizeAnswer(practice.answer) ||
    normalizeAnswer(student_answer).includes(normalizeAnswer(practice.answer)) ||
    normalizeAnswer(practice.answer).includes(normalizeAnswer(student_answer));

  const now = new Date().toISOString();
  const { data, error } = await client
    .from('practice_questions')
    .update({
      student_answer: student_answer.trim(),
      is_correct: isCorrect,
      answered_at: now,
    })
    .eq('id', pid)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    practice: data,
    is_correct: isCorrect,
    correct_answer: practice.answer,
    explanation: practice.explanation,
  });
}

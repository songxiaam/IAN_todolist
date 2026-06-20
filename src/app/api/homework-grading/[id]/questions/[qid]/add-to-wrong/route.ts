import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';
import { buildWrongQuestionRecord } from '@/lib/wrong-question-service';

const GRADING_BUCKET = 'homework-grading';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, qid } = await params;
  const gradingId = parseInt(id, 10);
  const questionId = parseInt(qid, 10);
  const client = getSupabaseClient(auth.session);

  const { data: grading, error: gError } = await client
    .from('homework_gradings')
    .select('*')
    .eq('id', gradingId)
    .eq('family_id', auth.profile.family_id)
    .maybeSingle();

  if (gError || !grading) {
    return NextResponse.json({ error: '批改记录不存在' }, { status: 404 });
  }

  if (auth.profile.role === 'student' && grading.student_id !== auth.userId) {
    return NextResponse.json({ error: '无权操作' }, { status: 403 });
  }

  const { data: question, error: qError } = await client
    .from('grading_questions')
    .select('*')
    .eq('id', questionId)
    .eq('grading_id', gradingId)
    .maybeSingle();

  if (qError || !question) {
    return NextResponse.json({ error: '题目不存在' }, { status: 404 });
  }

  if (question.wrong_question_id) {
    return NextResponse.json({ error: '已添加到错题集' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: fileData, error: dlError } = await admin.storage
    .from(GRADING_BUCKET)
    .download(grading.original_image_path);

  if (dlError || !fileData) {
    return NextResponse.json({ error: '无法读取原图' }, { status: 500 });
  }

  const sourceBuffer = Buffer.from(await fileData.arrayBuffer());
  const bbox = JSON.parse(question.crop_bbox) as { x: number; y: number; w: number; h: number };

  const record = await buildWrongQuestionRecord({
    studentId: grading.student_id,
    familyId: grading.family_id,
    sourceBuffer,
    sourceMime: 'image/jpeg',
    sourcePath: grading.original_image_path,
    bbox,
    sourceType: 'grading',
    sourceGradingQuestionId: question.id,
    subjectHint: grading.subject,
    prefilled: {
      subject: grading.subject,
      question_text: question.question_text,
      student_answer: question.student_answer,
      correct_answer: question.correct_answer,
      solution_steps: question.solution_steps,
      error_analysis: question.feedback,
    },
  });

  const { data: wrongQ, error: insertError } = await client
    .from('wrong_questions')
    .insert(record)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await client
    .from('grading_questions')
    .update({ wrong_question_id: wrongQ.id })
    .eq('id', question.id);

  const cropUrl = admin.storage.from('wrong-questions').getPublicUrl(wrongQ.image_path).data.publicUrl;

  return NextResponse.json({ ...wrongQ, image_url: cropUrl });
}

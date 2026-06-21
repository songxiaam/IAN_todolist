import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';
import { cropImageBuffer } from '@/lib/image-crop';
import type { NormalizedBBox } from '@/lib/image-crop';
import { gradeQuestionCrop } from '@/lib/ai/grade-homework';

const BUCKET = 'homework-grading';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, qid } = await params;
  const gradingId = Number(id);
  const questionId = Number(qid);
  if (!gradingId || !questionId) {
    return NextResponse.json({ error: '无效 ID' }, { status: 400 });
  }

  let body: { bbox?: NormalizedBBox };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 });
  }

  const bbox = body.bbox;
  if (!bbox || typeof bbox.x !== 'number') {
    return NextResponse.json({ error: '请提供有效选区' }, { status: 400 });
  }

  const client = getSupabaseClient(auth.session);
  const { data: grading, error: gradingError } = await client
    .from('homework_gradings')
    .select('id, family_id, student_id, subject, original_image_path')
    .eq('id', gradingId)
    .eq('family_id', auth.profile.family_id)
    .single();

  if (gradingError || !grading) {
    return NextResponse.json({ error: '批改记录不存在' }, { status: 404 });
  }

  const { data: question, error: questionError } = await client
    .from('grading_questions')
    .select('*')
    .eq('id', questionId)
    .eq('grading_id', gradingId)
    .single();

  if (questionError || !question) {
    return NextResponse.json({ error: '题目不存在' }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();
  const { data: fileData, error: downloadError } = await admin.storage
    .from(BUCKET)
    .download(grading.original_image_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: '无法读取原图' }, { status: 500 });
  }

  const sourceBuffer = Buffer.from(await fileData.arrayBuffer());
  const cropBuffer = await cropImageBuffer(sourceBuffer, bbox);
  const graded = await gradeQuestionCrop(cropBuffer, 'image/jpeg', grading.subject);

  const cropPath = `${grading.family_id}/${grading.student_id}/${gradingId}/q${question.question_index}.jpg`;
  await admin.storage.from(BUCKET).upload(cropPath, cropBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  const { data: updated, error: updateError } = await client
    .from('grading_questions')
    .update({
      crop_image_path: cropPath,
      crop_bbox: JSON.stringify(bbox),
      question_text: graded.question_text,
      student_answer: graded.student_answer,
      correct_answer: graded.correct_answer,
      solution_steps: graded.solution_steps,
      is_correct: graded.is_correct,
      feedback: graded.feedback,
    })
    .eq('id', questionId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const cropUrl = admin.storage.from(BUCKET).getPublicUrl(cropPath).data.publicUrl;
  return NextResponse.json({ ...updated, crop_image_url: cropUrl });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, qid } = await params;
  const gradingId = Number(id);
  const questionId = Number(qid);

  const client = getSupabaseClient(auth.session);
  const { data: grading } = await client
    .from('homework_gradings')
    .select('id')
    .eq('id', gradingId)
    .eq('family_id', auth.profile.family_id)
    .single();

  if (!grading) {
    return NextResponse.json({ error: '批改记录不存在' }, { status: 404 });
  }

  const { error } = await client
    .from('grading_questions')
    .delete()
    .eq('id', questionId)
    .eq('grading_id', gradingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await client
    .from('grading_questions')
    .select('*', { count: 'exact', head: true })
    .eq('grading_id', gradingId);

  const correctCount = await client
    .from('grading_questions')
    .select('is_correct')
    .eq('grading_id', gradingId);

  const correct = (correctCount.data ?? []).filter((q) => q.is_correct).length;

  await client
    .from('homework_gradings')
    .update({ question_count: count ?? 0, correct_count: correct })
    .eq('id', gradingId);

  return NextResponse.json({ ok: true });
}

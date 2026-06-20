import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';
import { gradeHomeworkImage, isAiConfigured } from '@/lib/ai';
import { cropImageBuffer } from '@/lib/image-crop';
import { readStudentIdFromForm, readStudentIdFromQuery, resolveTargetStudentId } from '@/lib/student-target';

const BUCKET = 'homework-grading';

export async function GET(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const studentId = readStudentIdFromQuery(req);

  const client = getSupabaseClient(auth.session);
  let query = client
    .from('homework_gradings')
    .select('*, grading_questions(*)')
    .eq('family_id', auth.profile.family_id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (auth.profile.role === 'student') {
    query = query.eq('student_id', auth.userId);
  } else if (studentId) {
    query = query.eq('student_id', studentId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const admin = getSupabaseAdminClient();
  const items = (data ?? []).map((g) => {
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(g.original_image_path);
    const questions = (g.grading_questions ?? [])
      .sort((a: { question_index: number }, b: { question_index: number }) => a.question_index - b.question_index)
      .map((q: { crop_image_path: string }) => {
        const cropUrl = admin.storage.from(BUCKET).getPublicUrl(q.crop_image_path).data.publicUrl;
        return { ...q, crop_image_url: cropUrl };
      });
    return { ...g, original_image_url: urlData.publicUrl, grading_questions: questions };
  });

  return NextResponse.json({ items, aiConfigured: isAiConfigured() });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: '未配置 AI 接口' }, { status: 503 });
  }

  const formData = await req.formData();
  const target = await resolveTargetStudentId(auth, readStudentIdFromForm(formData));
  if ('error' in target) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }

  const file = formData.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传作业照片' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let gradeResult;
  try {
    gradeResult = await gradeHomeworkImage(buffer, file.type);
  } catch (error) {
    const message = error instanceof Error ? error.message : '批改失败';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = getSupabaseAdminClient();
  const ext = file.name.split('.').pop() || 'jpg';
  const originalPath = `${auth.profile.family_id}/${target.studentId}/${Date.now()}-full.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(originalPath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: `上传失败: ${uploadError.message}。请创建公开存储桶 homework-grading` },
      { status: 500 },
    );
  }

  const client = getSupabaseClient(auth.session);
  const correctCount = gradeResult.questions.filter((q) => q.is_correct).length;

  const { data: grading, error: gradingError } = await client
    .from('homework_gradings')
    .insert({
      student_id: target.studentId,
      family_id: auth.profile.family_id,
      subject: gradeResult.subject,
      original_image_path: originalPath,
      question_count: gradeResult.questions.length,
      correct_count: correctCount,
    })
    .select()
    .single();

  if (gradingError) {
    return NextResponse.json({ error: gradingError.message }, { status: 500 });
  }

  const questionRows = [];
  for (const q of gradeResult.questions) {
    const cropBuffer = await cropImageBuffer(buffer, q.bbox);
    const cropPath = `${auth.profile.family_id}/${target.studentId}/${grading.id}/q${q.index}.jpg`;
    await admin.storage.from(BUCKET).upload(cropPath, cropBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    questionRows.push({
      grading_id: grading.id,
      question_index: q.index,
      crop_image_path: cropPath,
      crop_bbox: JSON.stringify(q.bbox),
      question_text: q.question_text,
      student_answer: q.student_answer,
      correct_answer: q.correct_answer,
      solution_steps: q.solution_steps,
      is_correct: q.is_correct,
      feedback: q.feedback,
    });
  }

  const { data: questions, error: qError } = await client
    .from('grading_questions')
    .insert(questionRows)
    .select();

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  const originalUrl = admin.storage.from(BUCKET).getPublicUrl(originalPath).data.publicUrl;
  const questionsWithUrl = (questions ?? []).map((q) => ({
    ...q,
    crop_image_url: admin.storage.from(BUCKET).getPublicUrl(q.crop_image_path).data.publicUrl,
  }));

  return NextResponse.json({
    ...grading,
    original_image_url: originalUrl,
    grading_questions: questionsWithUrl,
  });
}

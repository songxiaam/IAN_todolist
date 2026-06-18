import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';
import { analyzeWrongQuestionImage, isAiConfigured } from '@/lib/ai';

const BUCKET = 'wrong-questions';

export async function GET(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('student_id');

  const client = getSupabaseClient(auth.session);
  let query = client
    .from('wrong_questions')
    .select('*')
    .eq('family_id', auth.profile.family_id)
    .order('created_at', { ascending: false });

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
  const items = (data ?? []).map((item) => {
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(item.image_path);
    return { ...item, image_url: urlData.publicUrl };
  });

  return NextResponse.json({ items, aiConfigured: isAiConfigured() });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.profile.role !== 'student') {
    return NextResponse.json({ error: '只有学生可以收录错题' }, { status: 403 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: '未配置 AI 接口，请联系家长在服务端设置 AI_API_BASE_URL 和 AI_API_KEY' },
      { status: 503 },
    );
  }

  const formData = await req.formData();
  const file = formData.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传错题照片' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '仅支持图片格式' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let analysis;
  try {
    analysis = await analyzeWrongQuestionImage(buffer, file.type);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 解析失败';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = getSupabaseAdminClient();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${auth.profile.family_id}/${auth.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: `上传失败: ${uploadError.message}。请在 Supabase 创建公开存储桶 wrong-questions` },
      { status: 500 },
    );
  }

  const client = getSupabaseClient(auth.session);
  const { data, error } = await client
    .from('wrong_questions')
    .insert({
      student_id: auth.userId,
      family_id: auth.profile.family_id,
      subject: analysis.subject,
      image_path: path,
      question_text: analysis.question,
      student_answer: analysis.student_answer,
      correct_answer: analysis.correct_answer,
      error_analysis: analysis.error_analysis,
      knowledge_points: JSON.stringify(analysis.knowledge_points),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ...data, image_url: urlData.publicUrl });
}

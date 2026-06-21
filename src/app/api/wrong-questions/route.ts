import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';
import { isAiConfigured } from '@/lib/ai';
import { buildWrongQuestionRecord, WRONG_QUESTIONS_BUCKET } from '@/lib/wrong-question-service';
import { serializeWrongQuestion } from '@/lib/wrong-question-serialize';
import { normalizeImageBuffer } from '@/lib/image-crop';
import type { NormalizedBBox } from '@/lib/image-crop-types';
import { readStudentIdFromForm, readStudentIdFromQuery, resolveTargetStudentId } from '@/lib/student-target';

export async function GET(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const studentId = readStudentIdFromQuery(req);

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
  const items = (data ?? []).map((item) => serializeWrongQuestion(item, admin));

  return NextResponse.json({ items, aiConfigured: isAiConfigured() });
}

/** 框选错题：上传原图 + 多个选区（只存原图与坐标） */
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
  const regionsRaw = formData.get('regions');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传照片' }, { status: 400 });
  }

  let regions: NormalizedBBox[] = [];
  try {
    regions = JSON.parse(String(regionsRaw ?? '[]')) as NormalizedBBox[];
  } catch {
    return NextResponse.json({ error: '选区格式无效' }, { status: 400 });
  }

  if (regions.length === 0) {
    return NextResponse.json({ error: '请框选至少一道错题' }, { status: 400 });
  }

  const sourceBuffer = await normalizeImageBuffer(Buffer.from(await file.arrayBuffer()));
  const admin = getSupabaseAdminClient();
  const sourcePath = `${auth.profile.family_id}/${target.studentId}/sources/${Date.now()}-full.jpg`;

  const { error: uploadError } = await admin.storage
    .from(WRONG_QUESTIONS_BUCKET)
    .upload(sourcePath, sourceBuffer, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const client = getSupabaseClient(auth.session);
  const created = [];

  for (const bbox of regions) {
    const record = await buildWrongQuestionRecord({
      studentId: target.studentId,
      familyId: auth.profile.family_id,
      sourceBuffer,
      sourceMime: 'image/jpeg',
      sourcePath,
      bbox,
      sourceType: 'crop',
    });

    const { data, error } = await client.from('wrong_questions').insert(record).select().single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    created.push(serializeWrongQuestion(data, admin));
  }

  return NextResponse.json({ items: created, count: created.length });
}

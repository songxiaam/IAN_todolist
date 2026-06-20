import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';
import { generateSimilarQuestions, isAiConfigured } from '@/lib/ai';
import { renderPracticeSheetPng } from '@/lib/practice-sheet';

const SHEET_BUCKET = 'wrong-questions';

export async function POST(req: NextRequest) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: '未配置 AI 接口' }, { status: 503 });
  }

  const body = await req.json();
  const { wrong_question_ids: ids } = body as { wrong_question_ids?: number[] };

  if (!ids?.length) {
    return NextResponse.json({ error: '请勾选至少一道错题' }, { status: 400 });
  }

  const client = getSupabaseClient(auth.session);
  const { data: records, error } = await client
    .from('wrong_questions')
    .select('*')
    .in('id', ids)
    .eq('family_id', auth.profile.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!records?.length) {
    return NextResponse.json({ error: '未找到错题' }, { status: 404 });
  }

  for (const r of records) {
    if (auth.profile.role === 'student' && r.student_id !== auth.userId) {
      return NextResponse.json({ error: '无权操作' }, { status: 403 });
    }
  }

  const sections = [];
  for (const record of records) {
    const generated = await generateSimilarQuestions(record, 2);
    const label = record.question_text?.slice(0, 20) || `错题 #${record.id}`;
    sections.push({ sourceLabel: label, items: generated });

    const rows = generated.map((q) => ({
      wrong_question_id: record.id,
      question_text: q.question,
      question_type: q.question_type,
      options: q.options ? JSON.stringify(q.options) : null,
      answer: q.answer,
      explanation: q.explanation,
    }));
    await client.from('practice_questions').insert(rows);
    await client
      .from('wrong_questions')
      .update({
        review_count: (record.review_count ?? 0) + 1,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq('id', record.id);
  }

  const sheetStudentId = records[0].student_id;
  const pngBuffer = await renderPracticeSheetPng('错题巩固练习卷', sections);
  const admin = getSupabaseAdminClient();
  const sheetPath = `${auth.profile.family_id}/${sheetStudentId}/sheets/${Date.now()}.png`;

  const { error: uploadError } = await admin.storage
    .from(SHEET_BUCKET)
    .upload(sheetPath, pngBuffer, { contentType: 'image/png', upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const sheetUrl = admin.storage.from(SHEET_BUCKET).getPublicUrl(sheetPath).data.publicUrl;

  return NextResponse.json({
    sheet_url: sheetUrl,
    format: 'png',
    size: 'A4',
    question_count: sections.reduce((n, s) => n + s.items.length, 0),
  });
}

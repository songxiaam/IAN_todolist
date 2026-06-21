import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';
import { isAiConfigured } from '@/lib/ai';
import {
  reanalyzeWrongQuestionFromBbox,
  WRONG_QUESTIONS_BUCKET,
} from '@/lib/wrong-question-service';
import {
  serializeWrongQuestion,
  countSharedOriginalSources,
  getOriginalImageBucket,
} from '@/lib/wrong-question-serialize';
import { normalizeImageBuffer } from '@/lib/image-crop';
import type { NormalizedBBox } from '@/lib/image-crop-types';

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

async function downloadOriginalBuffer(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  sourceType: string | null,
  originalPath: string,
): Promise<Buffer | null> {
  const bucket = getOriginalImageBucket(sourceType);
  const { data, error } = await admin.storage.from(bucket).download(originalPath);
  if (error || !data) return null;
  const raw = Buffer.from(await data.arrayBuffer());
  if (bucket === WRONG_QUESTIONS_BUCKET) {
    return normalizeImageBuffer(raw);
  }
  return raw;
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
  return NextResponse.json(serializeWrongQuestion(record, admin));
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
  const recordId = parseInt(id, 10);
  const body = await req.json();
  const client = getSupabaseClient(auth.session);
  const record = await getWrongQuestion(client, recordId, auth.profile.family_id);

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
  if (typeof body.mastery_level === 'number') {
    const level = Math.max(0, Math.min(3, body.mastery_level));
    updates.mastery_level = level;
    updates.mastered = level >= 2;
  }
  if (body.action === 'review') {
    updates.review_count = (record.review_count ?? 0) + 1;
    updates.last_reviewed_at = new Date().toISOString();
  }

  const bbox = body.bbox as NormalizedBBox | undefined;
  if (bbox && typeof bbox.x === 'number') {
    updates.crop_bbox = JSON.stringify(bbox);

    if (body.reanalyze !== false && isAiConfigured() && record.original_image_path) {
      const admin = getSupabaseAdminClient();
      const sourceBuffer = await downloadOriginalBuffer(
        admin,
        record.source_type,
        record.original_image_path,
      );
      if (sourceBuffer) {
        try {
          const analyzed = await reanalyzeWrongQuestionFromBbox(
            sourceBuffer,
            bbox,
            record.subject,
          );
          Object.assign(updates, analyzed);
        } catch {
          /* 框选已保存，解析失败不阻断 */
        }
      }
    }
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

  const admin = getSupabaseAdminClient();
  return NextResponse.json(serializeWrongQuestion(data, admin));
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

  if (record.image_path) {
    await admin.storage.from(BUCKET).remove([record.image_path]);
  }

  if (
    record.original_image_path &&
    record.source_type === 'crop' &&
    (await countSharedOriginalSources(client, record.original_image_path, record.id)) === 0
  ) {
    await admin.storage.from(WRONG_QUESTIONS_BUCKET).remove([record.original_image_path]);
  }

  const { error } = await client.from('wrong_questions').delete().eq('id', record.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

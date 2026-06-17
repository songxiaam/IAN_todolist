import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthProfile } from '@/lib/api-auth';

const BUCKET = 'homework-media';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const homeworkId = parseInt(id, 10);
  const client = getSupabaseClient(auth.session);

  const { data: homework, error: homeworkError } = await client
    .from('homeworks')
    .select('id, family_id, assigned_to')
    .eq('id', homeworkId)
    .maybeSingle();

  if (homeworkError || !homework) {
    return NextResponse.json({ error: '作业不存在' }, { status: 404 });
  }

  if (
    auth.profile.role === 'student' &&
    homework.assigned_to !== auth.userId
  ) {
    return NextResponse.json({ error: '无权上传' }, { status: 403 });
  }

  const formData = await req.formData();
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: '请选择文件' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const uploaded: { id: number; url: string; media_type: string }[] = [];

  for (const file of files) {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      continue;
    }

    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const path = `${homework.family_id}/${homeworkId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: `上传失败: ${uploadError.message}。请在 Supabase 创建公开存储桶 homework-media` },
        { status: 500 },
      );
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

    const { data: mediaRow, error: mediaError } = await admin
      .from('homework_media')
      .insert({
        homework_id: homeworkId,
        file_path: path,
        media_type: isVideo ? 'video' : 'image',
        uploaded_by: auth.userId,
      })
      .select('id, media_type')
      .single();

    if (mediaError) {
      return NextResponse.json({ error: mediaError.message }, { status: 500 });
    }

    uploaded.push({
      id: mediaRow.id,
      url: urlData.publicUrl,
      media_type: mediaRow.media_type,
    });
  }

  return NextResponse.json({ uploaded });
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
  const homeworkId = parseInt(id, 10);
  const client = getSupabaseClient(auth.session);

  const { data, error } = await client
    .from('homework_media')
    .select('*')
    .eq('homework_id', homeworkId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const admin = getSupabaseAdminClient();
  const media = (data ?? []).map((item) => {
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(item.file_path);
    return { ...item, url: urlData.publicUrl };
  });

  return NextResponse.json(media);
}

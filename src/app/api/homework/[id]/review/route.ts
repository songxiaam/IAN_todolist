import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { adjustPoints } from '@/lib/points';
import { verifyParentSession } from '@/lib/api-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parent = await verifyParentSession(req);
  if ('error' in parent) {
    return NextResponse.json({ error: parent.error }, { status: parent.status });
  }

  const { id } = await params;
  const homeworkId = parseInt(id, 10);
  const body = await req.json();
  const { action } = body as { action: 'approve' | 'reject' };

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: '无效操作' }, { status: 400 });
  }

  const client = getSupabaseClient(parent.session);
  const { data: homework, error: homeworkError } = await client
    .from('homeworks')
    .select('*')
    .eq('id', homeworkId)
    .eq('family_id', parent.profile.family_id)
    .maybeSingle();

  if (homeworkError || !homework) {
    return NextResponse.json({ error: '作业不存在' }, { status: 404 });
  }

  if (homework.status !== 'completed') {
    return NextResponse.json({ error: '只能审核已完成的作业' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const points = homework.points ?? 0;

  if (action === 'approve') {
    const { data, error } = await client
      .from('homeworks')
      .update({
        review_status: 'approved',
        reviewed_at: now,
        reviewed_by: parent.profile.id,
      })
      .eq('id', homeworkId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ homework: data });
  }

  if (homework.review_status === 'rejected') {
    return NextResponse.json({ error: '该作业已驳回' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  if (points > 0 && homework.assigned_to && homework.review_status !== 'rejected') {
    try {
      await adjustPoints(
        admin,
        homework.assigned_to,
        -points,
        'homework_review_reject',
        'homework',
        String(homeworkId),
        `作业审核未通过「${homework.title}」`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '扣回积分失败';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const { data, error } = await client
    .from('homeworks')
    .update({
      review_status: 'rejected',
      reviewed_at: now,
      reviewed_by: parent.profile.id,
    })
    .eq('id', homeworkId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ homework: data, pointsDeducted: points });
}

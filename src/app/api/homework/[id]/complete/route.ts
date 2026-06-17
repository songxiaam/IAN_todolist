import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { adjustPoints } from '@/lib/points';
import { getAuthProfile } from '@/lib/api-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthProfile(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.profile.role !== 'student') {
    return NextResponse.json({ error: '只有学生可以完成作业' }, { status: 403 });
  }

  const { id } = await params;
  const homeworkId = parseInt(id, 10);
  const client = getSupabaseClient(auth.session);

  const { data: homework, error: homeworkError } = await client
    .from('homeworks')
    .select('*')
    .eq('id', homeworkId)
    .eq('assigned_to', auth.userId)
    .maybeSingle();

  if (homeworkError || !homework) {
    return NextResponse.json({ error: '作业不存在' }, { status: 404 });
  }

  if (homework.status === 'completed') {
    return NextResponse.json({ error: '作业已完成' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const points = homework.points ?? 0;
  const reviewStatus = points > 0 ? 'pending' : 'approved';

  const { data: updated, error: updateError } = await client
    .from('homeworks')
    .update({
      status: 'completed',
      completed_at: now,
      review_status: reviewStatus,
    })
    .eq('id', homeworkId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let pointsAwarded = 0;
  if (points > 0) {
    const admin = getSupabaseAdminClient();
    await adjustPoints(
      admin,
      auth.userId,
      points,
      'homework_complete',
      'homework',
      String(homeworkId),
      `完成作业「${homework.title}」`,
    );
    pointsAwarded = points;
  }

  const { data: profile } = await client
    .from('profiles')
    .select('points_balance')
    .eq('id', auth.userId)
    .single();

  return NextResponse.json({
    homework: updated,
    pointsAwarded,
    pointsBalance: profile?.points_balance ?? 0,
    needsReview: reviewStatus === 'pending',
  });
}

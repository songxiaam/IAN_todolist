import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { verifyParentSession } from '@/lib/api-auth';
import { createPasswordRecord } from '@/lib/password';

export async function GET(req: NextRequest) {
  const parent = await verifyParentSession(req);
  if ('error' in parent) {
    return NextResponse.json({ error: parent.error }, { status: parent.status });
  }

  const client = getSupabaseClient(parent.session);
  const { data, error } = await client
    .from('families')
    .select('writeoff_password_hash')
    .eq('id', parent.profile.family_id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    hasWriteoffPassword: Boolean(data?.writeoff_password_hash),
  });
}

export async function PATCH(req: NextRequest) {
  const parent = await verifyParentSession(req);
  if ('error' in parent) {
    return NextResponse.json({ error: parent.error }, { status: parent.status });
  }

  const body = await req.json();
  const { writeoff_password } = body;

  if (!writeoff_password || writeoff_password.length < 4) {
    return NextResponse.json({ error: '核销密码至少4位' }, { status: 400 });
  }

  const { salt, hash } = createPasswordRecord(writeoff_password);
  const admin = getSupabaseAdminClient();

  const { error } = await admin
    .from('families')
    .update({
      writeoff_salt: salt,
      writeoff_password_hash: hash,
    })
    .eq('id', parent.profile.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/server';
import { getAuthProfile } from '@/lib/api-auth';
import { isStudentInFamily } from '@/lib/homework';

type AuthOk = { profile: { role: string; family_id: string }; userId: string; session: string };

async function resolveTargetStudentId(
  auth: AuthOk,
  requestedStudentId: string | null | undefined,
): Promise<{ studentId: string } | { error: string; status: number }> {
  if (auth.profile.role === 'student') {
    return { studentId: auth.userId };
  }

  const studentId = requestedStudentId?.trim();
  if (!studentId) {
    return { error: '请选择要关联的学生', status: 400 };
  }

  const client = getSupabaseClient(auth.session);
  const valid = await isStudentInFamily(client, studentId, auth.profile.family_id);
  if (!valid) {
    return { error: '所选学生不在当前家庭', status: 400 };
  }

  return { studentId };
}

function readStudentIdFromForm(formData: FormData): string | null {
  const raw = formData.get('student_id');
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function readStudentIdFromQuery(req: NextRequest): string | null {
  return req.nextUrl.searchParams.get('student_id');
}

export { resolveTargetStudentId, readStudentIdFromForm, readStudentIdFromQuery };

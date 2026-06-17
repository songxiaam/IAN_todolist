import { SupabaseClient } from '@supabase/supabase-js';

async function getFamilyStudents(
  client: SupabaseClient,
  familyId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id, name')
    .eq('family_id', familyId)
    .eq('role', 'student');

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function isStudentInFamily(
  client: SupabaseClient,
  studentId: string,
  familyId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('id', studentId)
    .eq('family_id', familyId)
    .eq('role', 'student')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

function resolveAssignedStudent(
  students: { id: string }[],
  assignedTo: string | null | undefined,
): { assignedTo: string | null; error?: string } {
  if (students.length === 0) {
    return { assignedTo: assignedTo ?? null };
  }

  if (students.length === 1) {
    return { assignedTo: assignedTo ?? students[0].id };
  }

  if (!assignedTo) {
    return { assignedTo: null, error: '请选择要分配的学生' };
  }

  return { assignedTo };
}

export { getFamilyStudents, isStudentInFamily, resolveAssignedStudent };

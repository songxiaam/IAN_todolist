import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseCredentials } from '@/lib/supabase/server';

interface UserProfile {
  id: string;
  role: string;
  family_id: string;
  name: string;
  points_balance?: number;
}

async function getAuthProfile(request: NextRequest): Promise<
  | { profile: UserProfile; session: string; userId: string }
  | { error: string; status: number }
> {
  const session = request.headers.get('x-session');
  if (!session) {
    return { error: '请先登录', status: 401 };
  }

  const client = getSupabaseClient(session);
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return { error: '用户信息无效', status: 401 };
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, role, family_id, name, points_balance')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: '请先设置您的角色', status: 400 };
  }

  return { profile, session, userId: user.id };
}

async function verifyParentSession(request: NextRequest): Promise<
  | { profile: UserProfile; session: string }
  | { error: string; status: number }
> {
  const auth = await getAuthProfile(request);
  if ('error' in auth) return auth;

  if (auth.profile.role !== 'parent') {
    return { error: '只有家长可以执行此操作', status: 403 };
  }

  if (!auth.profile.family_id) {
    return { error: '请先创建家庭', status: 400 };
  }

  return { profile: auth.profile, session: auth.session };
}

async function verifyStudentSession(request: NextRequest): Promise<
  | { profile: UserProfile; session: string }
  | { error: string; status: number }
> {
  const auth = await getAuthProfile(request);
  if ('error' in auth) return auth;

  if (auth.profile.role !== 'student') {
    return { error: '只有学生可以执行此操作', status: 403 };
  }

  return { profile: auth.profile, session: auth.session };
}

function getUserClient(token: string) {
  const { url, anonKey } = getSupabaseCredentials();
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export { getAuthProfile, verifyParentSession, verifyStudentSession, getUserClient };
export type { UserProfile };

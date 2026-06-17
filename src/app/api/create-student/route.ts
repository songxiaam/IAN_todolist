import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseServiceRoleKey,
  getSupabaseCredentials,
} from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import {
  isValidUsername,
  sanitizeUsername,
  toStudentAuthEmail,
} from '@/lib/auth';
import { verifyParentSession } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const parent = await verifyParentSession(request);
    if ('error' in parent) {
      return NextResponse.json({ error: parent.error }, { status: parent.status });
    }

    const body = await request.json();
    const { username, password, name } = body;

    if (!username || !password || !name) {
      return NextResponse.json({ error: '请填写用户名、密码和姓名' }, { status: 400 });
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: '用户名需为 2-30 位字母、数字或下划线' },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少需要6位' }, { status: 400 });
    }

    const sanitizedUsername = sanitizeUsername(username);
    const authEmail = toStudentAuthEmail(sanitizedUsername);

    const serviceRoleKey = getSupabaseServiceRoleKey();
    if (!serviceRoleKey) {
      return NextResponse.json({ error: '服务配置错误' }, { status: 500 });
    }

    const { url } = getSupabaseCredentials();
    const adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', sanitizedUsername)
      .eq('role', 'student')
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: '该用户名已被使用' }, { status: 400 });
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { name, username: sanitizedUsername, role: 'student' },
    });

    if (createError) {
      console.error('创建用户错误:', createError);
      if (createError.message.includes('already registered')) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 400 });
      }
      return NextResponse.json({ error: '创建账号失败: ' + createError.message }, { status: 500 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: '创建账号失败' }, { status: 500 });
    }

    const { error: profileCreateError } = await adminClient
      .from('profiles')
      .insert({
        id: newUser.user.id,
        role: 'student',
        family_id: parent.profile.family_id,
        name,
        username: sanitizedUsername,
      });

    if (profileCreateError) {
      console.error('创建 profile 错误:', profileCreateError);
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: '创建学生资料失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '学生账号创建成功',
      student: {
        id: newUser.user.id,
        username: sanitizedUsername,
        name,
      },
    });
  } catch (error) {
    console.error('创建学生账号错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

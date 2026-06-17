import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseClient,
  getSupabaseServiceRoleKey,
  getSupabaseCredentials,
} from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// 创建学生账号（家长操作）
export async function POST(request: NextRequest) {
  try {
    // 1. 验证家长身份
    const session = request.headers.get('x-session');
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { url, anonKey } = getSupabaseCredentials();
    const parentClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${session}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 验证家长身份
    const { data: { user }, error: userError } = await parentClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: '用户信息无效' }, { status: 401 });
    }

    // 获取家长的 profile
    const { data: parentProfile, error: profileError } = await parentClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !parentProfile) {
      return NextResponse.json({ error: '请先设置您的角色' }, { status: 400 });
    }

    if (parentProfile.role !== 'parent') {
      return NextResponse.json({ error: '只有家长可以创建学生账号' }, { status: 403 });
    }

    if (!parentProfile.family_id) {
      return NextResponse.json({ error: '请先创建家庭' }, { status: 400 });
    }

    // 2. 解析请求参数
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: '请填写邮箱、密码和姓名' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少需要6位' }, { status: 400 });
    }

    // 3. 使用 Service Role Key 创建学生账号
    const serviceRoleKey = getSupabaseServiceRoleKey();
    if (!serviceRoleKey) {
      return NextResponse.json({ error: '服务配置错误' }, { status: 500 });
    }

    const adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 创建用户（使用 admin API）
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 自动确认邮箱
      user_metadata: { name },
    });

    if (createError) {
      console.error('创建用户错误:', createError);
      if (createError.message.includes('already registered')) {
        return NextResponse.json({ error: '该邮箱已被注册' }, { status: 400 });
      }
      return NextResponse.json({ error: '创建账号失败: ' + createError.message }, { status: 500 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: '创建账号失败' }, { status: 500 });
    }

    // 4. 创建学生的 profile（关联到家长的家庭）
    const { error: profileCreateError } = await adminClient
      .from('profiles')
      .insert({
        id: newUser.user.id,
        role: 'student',
        family_id: parentProfile.family_id,
        name,
      });

    if (profileCreateError) {
      console.error('创建 profile 错误:', profileCreateError);
      // 尝试删除已创建的用户
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: '创建学生资料失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '学生账号创建成功',
      student: {
        id: newUser.user.id,
        email: newUser.user.email,
        name,
      },
    });
  } catch (error) {
    console.error('创建学生账号错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
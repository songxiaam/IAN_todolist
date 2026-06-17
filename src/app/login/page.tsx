'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { toLoginEmail } from '@/lib/auth';
import { APP_ICON, APP_NAME } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const { isLoading: configLoading, error: configError } = useSupabaseConfig();
  
  const [isLogin, setIsLogin] = useState(true);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center paper-bg">
        <Loader2 className="w-8 h-8 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center paper-bg">
        <p className="text-[#EF5350]">配置加载失败，请刷新页面重试</p>
      </div>
    );
  }

  const handleLogin = async () => {
    if (!account || !password) {
      setError('请填写账号和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const loginEmail = toLoginEmail(account);
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (loginError) {
        setError('账号或密码错误');
        return;
      }

      if (data.session) {
        router.push('/setup');
      }
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!account || !password || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }

    if (account.includes('@') === false) {
      setError('家长注册请使用邮箱，学生账号由家长创建');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要6个字符');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error: registerError } = await supabase.auth.signUp({
        email: account.trim(),
        password,
      });

      if (registerError) {
        setError(registerError.message);
        return;
      }

      if (data.session) {
        router.push('/setup');
      }
    } catch (err) {
      setError('注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center paper-bg p-4">
      {/* SVG 滤镜定义 */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="hand-drawn">
            <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="2" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="1" />
          </filter>
        </defs>
      </svg>
      
      {/* 手绘笔记本风格的登录卡片 */}
      <div className="w-full max-w-md sketchy-card p-8 sketchy-enter">
        {/* 应用图标 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full border-2 border-[#5D4037] overflow-hidden shadow-lg transform rotate-2 hover:rotate-0 transition-transform duration-300">
            <Image 
              src={APP_ICON} 
              alt={APP_NAME}
              width={80}
              height={80}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <h1 className="text-2xl text-[#5D4037] mt-3" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            {APP_NAME}
          </h1>
          {/* 手绘装饰线 */}
          <div className="w-24 sketchy-divider mt-2" />
        </div>
        
        {/* 登录/注册切换 */}
        <div className="flex gap-2 mb-6">
          <button
            className={`flex-1 py-3 px-4 text-lg font-medium transition-all ${
              isLogin 
                ? 'crayon-button text-[#FFFDE7]' 
                : 'bg-transparent text-[#5D4037] border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3]'
            }`}
            onClick={() => setIsLogin(true)}
          >
            ✏️ 登录
          </button>
          <button
            className={`flex-1 py-3 px-4 text-lg font-medium transition-all ${
              !isLogin 
                ? 'crayon-button-orange text-[#5D4037]' 
                : 'bg-transparent text-[#5D4037] border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3]'
            }`}
            onClick={() => setIsLogin(false)}
          >
            📝 注册
          </button>
        </div>

        {/* 表单 */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#5D4037] mb-1 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              {isLogin ? '📧 邮箱或学生用户名' : '📧 家长邮箱'}
            </label>
            <input
              type="text"
              placeholder={isLogin ? '家长填邮箱，学生填用户名...' : '请输入邮箱...'}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full py-3 px-4 pencil-input text-lg"
            />
            {isLogin && (
              <p className="text-xs text-[#8D6E63] mt-1" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                学生使用家长创建的用户名登录，无需邮箱
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-[#5D4037] mb-1 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              🔐 密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-3 px-4 pencil-input text-lg pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D6E63] hover:text-[#5D4037]"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="sketchy-enter">
              <label className="text-sm text-[#5D4037] mb-1 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                🔒 确认密码
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="请再次输入密码..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full py-3 px-4 pencil-input text-lg pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D6E63] hover:text-[#5D4037]"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="text-[#EF5350] text-sm mt-4 text-center transform -rotate-1">
            ⚠️ {error}
          </p>
        )}

        {/* 提交按钮 */}
        <button
          className="w-full mt-6 py-4 crayon-button text-[#FFFDE7] text-lg disabled:opacity-50"
          onClick={isLogin ? handleLogin : handleRegister}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            isLogin ? '🚀 开始使用' : '✨ 创建账号'
          )}
        </button>

        {/* 切换提示 */}
        {isLogin && (
          <p className="text-center text-sm text-[#8D6E63] mt-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            还没有账号？
            <button
              className="text-[#7CB342] hover:underline ml-1 font-medium"
              onClick={() => setIsLogin(false)}
            >
              去注册吧
            </button>
          </p>
        )}

        {!isLogin && (
          <p className="text-center text-sm text-[#8D6E63] mt-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            已有账号？
            <button
              className="text-[#7CB342] hover:underline ml-1 font-medium"
              onClick={() => setIsLogin(true)}
            >
              去登录
            </button>
          </p>
        )}

        {/* 手绘装饰 */}
        <div className="absolute -top-4 -right-4 text-4xl opacity-20 transform rotate-12">
          ✏️
        </div>
        <div className="absolute -bottom-3 -left-3 text-3xl opacity-20 transform -rotate-15">
          📚
        </div>
      </div>
    </div>
  );
}
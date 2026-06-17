'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { Loader2, Users, GraduationCap, Home, ArrowLeft } from 'lucide-react';

import { APP_ICON } from '@/lib/constants';

type Step = 'role' | 'family' | 'name';

export default function SetupPage() {
  const router = useRouter();
  const { isLoading: configLoading } = useSupabaseConfig();
  
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<'parent' | 'student' | null>(null);
  const [isNewFamily, setIsNewFamily] = useState(true);
  const [familyCode, setFamilyCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUserId(user.id);
      
      // 检查是否已有 profile
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) {
        const res = await fetch('/api/profile', {
          headers: { 'x-session': token }
        });
        const profile = await res.json();
        if (profile.id) {
          router.push('/');
        }
      }
    };
    
    if (!configLoading) {
      checkUser();
    }
  }, [configLoading, router]);

  if (configLoading || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center paper-bg">
        <Loader2 className="w-8 h-8 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  const handleCreateFamily = async () => {
    if (!name) {
      setError('请填写您的名字');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      if (!token) {
        router.push('/login');
        return;
      }

      // 创建家庭
      const familyRes = await fetch('/api/family', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-session': token 
        },
        body: JSON.stringify({ name: `${name}的家庭` })
      });

      const family = await familyRes.json();
      
      if (!family.id) {
        setError('创建家庭失败');
        return;
      }

      // 创建 profile
      const profileRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-session': token 
        },
        body: JSON.stringify({
          role,
          family_id: family.id,
          name
        })
      });

      if (profileRes.ok) {
        router.push('/');
      } else {
        setError('设置失败，请重试');
      }
    } catch (err) {
      setError('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!familyCode) {
      setError('请输入家庭码');
      return;
    }

    if (!name) {
      setError('请填写您的名字');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      if (!token) {
        router.push('/login');
        return;
      }

      // 查找家庭
      const familyRes = await fetch(`/api/family/${familyCode}`, {
        headers: { 'x-session': token }
      });

      const family = await familyRes.json();
      
      if (!family.id) {
        setError('家庭码不存在');
        return;
      }

      // 创建 profile
      const profileRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-session': token 
        },
        body: JSON.stringify({
          role,
          family_id: family.id,
          name
        })
      });

      if (profileRes.ok) {
        router.push('/');
      } else {
        const errData = await profileRes.json();
        setError(errData.error || '设置失败，请重试');
      }
    } catch (err) {
      setError('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center paper-bg p-4">
      {/* 手绘笔记本风格的设置卡片 */}
      <div className="w-full max-w-md sketchy-card p-8 sketchy-enter">
        {/* 应用图标 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full border-2 border-[#5D4037] overflow-hidden shadow-md transform -rotate-3">
            <Image 
              src={APP_ICON} 
              alt="作业管理"
              width={60}
              height={60}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <h1 className="text-xl text-[#5D4037] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            ✏️ 完善设置
          </h1>
        </div>

        {/* 步骤指示器 */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                ['role', 'family', 'name'].indexOf(step) + 1 >= i
                  ? 'bg-[#7CB342] text-[#FFFDE7] border-[#5D4037]'
                  : 'bg-[#FFFDE7] text-[#8D6E63] border-[#D7CCC8]'
              }`}
            >
              {i}
            </div>
          ))}
        </div>

        {/* 步骤1：角色选择 */}
        {step === 'role' && (
          <div className="space-y-4 sketchy-enter">
            <p className="text-center text-[#5D4037] mb-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              🎭 请选择您的角色
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setRole('parent')}
                className={`p-5 sketchy-border flex flex-col items-center gap-3 transition-all ${
                  role === 'parent' ? 'bg-[#7CB342]/20 transform -rotate-1' : 'bg-[#FFFDE7] hover:bg-[#F5E6D3]'
                }`}
              >
                <Users size={28} className={role === 'parent' ? 'text-[#7CB342]' : 'text-[#8D6E63]'} />
                <span className={`text-lg ${role === 'parent' ? 'text-[#7CB342]' : 'text-[#5D4037]'}`} style={{ fontFamily: "'Patrick Hand', cursive" }}>
                  👨‍👩‍👧 家长
                </span>
              </button>
              
              <button
                onClick={() => setRole('student')}
                className={`p-5 sketchy-border flex flex-col items-center gap-3 transition-all ${
                  role === 'student' ? 'bg-[#FFB74D]/20 transform rotate-1' : 'bg-[#FFFDE7] hover:bg-[#F5E6D3]'
                }`}
              >
                <GraduationCap size={28} className={role === 'student' ? 'text-[#FFB74D]' : 'text-[#8D6E63]'} />
                <span className={`text-lg ${role === 'student' ? 'text-[#FFB74D]' : 'text-[#5D4037]'}`} style={{ fontFamily: "'Patrick Hand', cursive" }}>
                  🎒 学生
                </span>
              </button>
            </div>

            <button
              className="w-full py-4 crayon-button text-[#FFFDE7] text-lg mt-6 disabled:opacity-50"
              onClick={() => role && setStep('family')}
              disabled={!role}
            >
              🚀 下一步
            </button>
          </div>
        )}

        {/* 步骤2：家庭设置 */}
        {step === 'family' && (
          <div className="space-y-4 sketchy-enter">
            <p className="text-center text-[#5D4037] mb-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              🏠 {role === 'parent' ? '创建或加入家庭' : '加入已有家庭'}
            </p>

            {role === 'parent' && (
              <p className="text-center text-sm text-[#8D6E63] mb-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                被邀请的家长请选择「加入已有家庭」，输入家庭码后享有相同管理权限
              </p>
            )}

            {role === 'parent' ? (
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setIsNewFamily(true)}
                  className={`p-4 sketchy-border text-left transition-all ${
                    isNewFamily ? 'bg-[#7CB342]/20 transform -rotate-1' : 'bg-[#FFFDE7] hover:bg-[#F5E6D3]'
                  }`}
                >
                  <p className={`text-lg ${isNewFamily ? 'text-[#7CB342]' : 'text-[#5D4037]'}`} style={{ fontFamily: "'Patrick Hand', cursive" }}>
                    ✨ 创建新家庭
                  </p>
                  <p className="text-sm text-[#8D6E63] mt-1">成为家庭管理员，管理作业</p>
                </button>
                
                <button
                  onClick={() => setIsNewFamily(false)}
                  className={`p-4 sketchy-border text-left transition-all ${
                    !isNewFamily ? 'bg-[#FFB74D]/20 transform rotate-1' : 'bg-[#FFFDE7] hover:bg-[#F5E6D3]'
                  }`}
                >
                  <p className={`text-lg ${!isNewFamily ? 'text-[#FFB74D]' : 'text-[#5D4037]'}`} style={{ fontFamily: "'Patrick Hand', cursive" }}>
                    🗝️ 加入已有家庭
                  </p>
                  <p className="text-sm text-[#8D6E63] mt-1">输入家庭码加入，与主家长共同管理
                  </p>
                </button>
              </div>
            ) : (
              <div>
                <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                  🔑 家庭码
                </label>
                <input
                  placeholder="请输入家长提供的家庭码..."
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value)}
                  className="w-full py-3 px-4 pencil-input text-lg"
                />
                <p className="text-sm text-[#8D6E63] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                  💡 请向家长询问家庭码
                </p>
              </div>
            )}

            {role === 'parent' && !isNewFamily && (
              <div>
                <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                  🔑 家庭码
                </label>
                <input
                  placeholder="请输入家庭码..."
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value)}
                  className="w-full py-3 px-4 pencil-input text-lg"
                />
              </div>
            )}

            {error && (
              <p className="text-[#EF5350] text-sm text-center transform -rotate-1">
                ⚠️ {error}
              </p>
            )}

            <button
              className="w-full py-4 crayon-button text-[#FFFDE7] text-lg mt-4 disabled:opacity-50"
              onClick={() => {
                if (role === 'student' || !isNewFamily) {
                  if (familyCode) setStep('name');
                  else setError('请输入家庭码');
                } else {
                  setStep('name');
                }
              }}
              disabled={loading}
            >
              🚀 下一步
            </button>
            
            <button
              className="w-full py-3 bg-transparent text-[#8D6E63] text-lg border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3] transition-all flex items-center justify-center gap-2"
              onClick={() => setStep('role')}
            >
              <ArrowLeft size={18} />
              返回上一步
            </button>
          </div>
        )}

        {/* 步骤3：姓名填写 */}
        {step === 'name' && (
          <div className="space-y-4 sketchy-enter">
            <p className="text-center text-[#5D4037] mb-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              📝 请填写您的名字
            </p>

            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {role === 'parent' ? '👨‍👩‍👧 家长姓名' : '🎒 学生姓名'}
              </label>
              <input
                placeholder="请输入姓名..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full py-3 px-4 pencil-input text-lg"
              />
            </div>

            {error && (
              <p className="text-[#EF5350] text-sm text-center transform -rotate-1">
                ⚠️ {error}
              </p>
            )}

            <button
              className="w-full py-4 crayon-button text-[#FFFDE7] text-lg mt-4 disabled:opacity-50"
              onClick={() => {
                if (role === 'parent' && isNewFamily) {
                  handleCreateFamily();
                } else {
                  handleJoinFamily();
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                '✅ 完成设置'
              )}
            </button>
            
            <button
              className="w-full py-3 bg-transparent text-[#8D6E63] text-lg border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3] transition-all flex items-center justify-center gap-2"
              onClick={() => setStep('family')}
            >
              <ArrowLeft size={18} />
              返回上一步
            </button>
          </div>
        )}

        {/* 手绘装饰 */}
        <div className="absolute -top-3 -left-3 text-3xl opacity-20 transform rotate-12">
          📝
        </div>
      </div>
    </div>
  );
}
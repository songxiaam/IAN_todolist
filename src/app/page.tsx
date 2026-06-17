'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Play,
  Pause,
  LogOut,
  GraduationCap,
  X,
  UserPlus,
} from 'lucide-react';

import { APP_ICON } from '@/lib/constants';

interface Profile {
  id: string;
  role: 'parent' | 'student';
  family_id: string;
  name: string;
}

interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'student';
}

interface Homework {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  deadline: string | null;
  estimated_minutes: number;
  status: 'pending' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  profiles: { name: string; role: string };
  assigned_profile: { name: string; role: string } | null;
}

export default function HomePage() {
  const router = useRouter();
  const { isLoading: configLoading } = useSupabaseConfig();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [currentTimer, setCurrentTimer] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  
  // 新作业表单
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSubject, setNewSubject] = useState('数学');
  const [newDeadline, setNewDeadline] = useState('');
  const [newEstimatedMinutes, setNewEstimatedMinutes] = useState(30);
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  // 创建学生账号表单
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);

  const fetchProfile = useCallback(async (token: string) => {
    const res = await fetch('/api/profile', {
      headers: { 'x-session': token }
    });
    const data = await res.json();
    if (!data.id) {
      router.push('/setup');
      return null;
    }
    return data as Profile;
  }, [router]);

  const fetchHomeworks = useCallback(async (token: string, familyId: string) => {
    const res = await fetch(`/api/homework?family_id=${familyId}`, {
      headers: { 'x-session': token }
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      return data as Homework[];
    }
    return [] as Homework[];
  }, []);

  const fetchFamilyMembers = useCallback(async (token: string) => {
    const res = await fetch('/api/family-members', {
      headers: { 'x-session': token }
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      return data as FamilyMember[];
    }
    return [] as FamilyMember[];
  }, []);

  const loadData = useCallback(async () => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const token = session.access_token;
    const profileData = await fetchProfile(token);
    
    if (profileData) {
      setProfile(profileData);
      const homeworkData = await fetchHomeworks(token, profileData.family_id);
      setHomeworks(homeworkData);
      const members = await fetchFamilyMembers(token);
      setFamilyMembers(members);
    }
    
    setLoading(false);
  }, [fetchProfile, fetchHomeworks, fetchFamilyMembers, router]);

  useEffect(() => {
    if (!configLoading) {
      loadData();
    }
  }, [configLoading, loadData]);

  // 倒计时逻辑
  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    
    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  const handleLogout = async () => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleAddHomework = async () => {
    if (!newTitle) return;
    
    setSaving(true);
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;

    const res = await fetch('/api/homework', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session': session.access_token
      },
      body: JSON.stringify({
        title: newTitle,
        description: newDescription,
        subject: newSubject,
        deadline: newDeadline || null,
        estimated_minutes: newEstimatedMinutes,
        assigned_to: newAssignedTo || null,
      })
    });

    if (res.ok) {
      setShowAddDialog(false);
      setNewTitle('');
      setNewDescription('');
      setNewSubject('数学');
      setNewDeadline('');
      setNewEstimatedMinutes(30);
      setNewAssignedTo('');
      loadData();
    }
    
    setSaving(false);
  };

  const handleDeleteHomework = async (id: number) => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;

    await fetch(`/api/homework/${id}`, {
      method: 'DELETE',
      headers: { 'x-session': session.access_token }
    });

    loadData();
  };

  const handleCreateStudent = async () => {
    if (!studentEmail || !studentPassword || !studentName) return;
    
    setCreatingStudent(true);
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setCreatingStudent(false);
      return;
    }

    const res = await fetch('/api/create-student', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session': session.access_token
      },
      body: JSON.stringify({
        email: studentEmail,
        password: studentPassword,
        name: studentName,
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // 清空表单并关闭对话框
      setStudentEmail('');
      setStudentPassword('');
      setStudentName('');
      setShowStudentDialog(false);
      // 刷新家庭成员列表
      loadData();
    } else {
      alert(data.error || '创建学生账号失败');
    }

    setCreatingStudent(false);
  };

  const handleStartHomework = async (homework: Homework) => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;

    const now = new Date().toISOString();
    await fetch(`/api/homework/${homework.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-session': session.access_token
      },
      body: JSON.stringify({
        status: 'in_progress',
        started_at: now,
      })
    });

    setCurrentTimer(homework.id);
    setTimerSeconds(homework.estimated_minutes * 60);
    setTimerRunning(true);
    loadData();
  };

  const handleCompleteHomework = async (homework: Homework) => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;

    const now = new Date().toISOString();
    await fetch(`/api/homework/${homework.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-session': session.access_token
      },
      body: JSON.stringify({
        status: 'completed',
        completed_at: now,
      })
    });

    setCurrentTimer(null);
    setTimerRunning(false);
    setTimerSeconds(0);
    loadData();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-[#8D6E63] border-[#D7CCC8]';
      case 'in_progress': return 'text-[#FFB74D] border-[#FFB74D]';
      case 'completed': return 'text-[#7CB342] border-[#7CB342]';
      default: return 'text-[#8D6E63] border-[#D7CCC8]';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '📝 待完成';
      case 'in_progress': return '⏳ 进行中';
      case 'completed': return '✅ 已完成';
      default: return '📝 待完成';
    }
  };

  if (configLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center paper-bg">
        <div className="sketchy-card p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#7CB342] mx-auto" />
          <p className="text-[#5D4037] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            正在加载...
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const students = familyMembers.filter(m => m.role === 'student');

  return (
    <div className="min-h-screen paper-bg pb-8">
      {/* 手绘风格 Header */}
      <div className="bg-[#F5E6D3] sticky top-0 z-10 border-b-2 border-[#5D4037]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#5D4037] overflow-hidden transform rotate-3">
              <Image src={APP_ICON} alt="App" width={40} height={40} className="w-full h-full object-cover" unoptimized />
            </div>
            <div>
              <h1 className="text-lg text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                📚 作业管理
              </h1>
              <p className="text-sm text-[#8D6E63]">
                {profile.role === 'parent' ? '👨‍👩‍👧 家长端' : '🎒 学生端'}
              </p>
            </div>
          </div>
          <button
            className="px-3 py-2 bg-transparent text-[#8D6E63] border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3] transition-all text-sm flex items-center gap-2"
            onClick={() => setShowLogoutDialog(true)}
          >
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </div>
      </div>

      {/* 学生端倒计时 - 手绘时钟风格 */}
      {profile.role === 'student' && currentTimer && timerRunning && (
        <div className="max-w-4xl mx-auto px-4 mt-4 sketchy-enter">
          <div className="sketchy-card p-6 text-center bg-[#FFB74D]/30">
            {/* 手绘时钟 */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-[#5D4037] bg-[#FFFDE7]" />
              {/* 时钟刻度 */}
              <div className="absolute inset-2 rounded-full border-2 border-dashed border-[#D7CCC8]" />
              {/* 时针 */}
              <div className="absolute top-1/2 left-1/2 w-1 h-12 bg-[#5D4037] origin-bottom transform -translate-x-1/2 -rotate-45" />
              {/* 分针 */}
              <div className="absolute top-1/2 left-1/2 w-0.5 h-16 bg-[#FFB74D] origin-bottom transform -translate-x-1/2 rotate-30" />
              {/* 中心点 */}
              <div className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full bg-[#5D4037] transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            
            {/* 倒计时数字 */}
            <div className="timer-sketchy">
              {formatTime(timerSeconds)}
            </div>
            
            <p className="text-[#5D4037] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              ⏰ 正在计时中...
            </p>
            
            <div className="flex gap-3 mt-4 justify-center">
              <button
                className="px-4 py-2 crayon-button-orange text-[#5D4037] flex items-center gap-2"
                onClick={() => setTimerRunning(!timerRunning)}
              >
                {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {timerRunning ? '暂停' : '继续'}
              </button>
              <button
                className="px-4 py-2 crayon-button text-[#FFFDE7] flex items-center gap-2"
                onClick={() => {
                  const hw = homeworks.find(h => h.id === currentTimer);
                  if (hw) handleCompleteHomework(hw);
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                完成!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 家长端 - 手绘统计卡片 */}
      {profile.role === 'parent' && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          {/* 家庭成员卡片 */}
          <div className="sketchy-card p-4 mb-4 sketchy-enter bg-[#F5E6D3]/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                🏠 家庭成员 ({familyMembers.length}人)
              </h3>
              <button
                className="px-3 py-2 crayon-button text-[#FFFDE7] text-sm flex items-center gap-1"
                onClick={() => setShowStudentDialog(true)}
              >
                <UserPlus className="w-4 h-4" />
                创建学生账号
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {familyMembers.map((member, idx) => (
                <div 
                  key={member.id}
                  className={`px-3 py-2 rounded-lg border-2 border-[#D7CCC8] bg-[#FFFDE7] transform ${idx % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
                  style={{ fontFamily: "'Patrick Hand', cursive" }}
                >
                  {member.role === 'parent' ? '👨‍👩‍👧' : '🎒'} {member.name}
                </div>
              ))}
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="sketchy-card p-4 text-center transform -rotate-1 sketchy-enter">
              <div className="text-2xl text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {homeworks.filter(h => h.status === 'pending').length}
              </div>
              <div className="text-sm text-[#8D6E63]">📝 待完成</div>
            </div>
            <div className="sketchy-card p-4 text-center transform rotate-1 sketchy-enter bg-[#FFB74D]/20">
              <div className="text-2xl text-[#FFB74D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {homeworks.filter(h => h.status === 'in_progress').length}
              </div>
              <div className="text-sm text-[#8D6E63]">⏳ 进行中</div>
            </div>
            <div className="sketchy-card p-4 text-center transform -rotate-2 sketchy-enter bg-[#7CB342]/20">
              <div className="text-2xl text-[#7CB342]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {homeworks.filter(h => h.status === 'completed').length}
              </div>
              <div className="text-sm text-[#8D6E63]">✅ 已完成</div>
            </div>
          </div>
        </div>
      )}

      {/* 手绘作业列表 */}
      <div className="max-w-4xl mx-auto px-4 mt-4">
        <div className="space-y-3">
          {homeworks.length === 0 && (
            <div className="sketchy-card p-8 text-center text-[#8D6E63]">
              {profile.role === 'parent' 
                ? '📝 还没有作业，点击下方按钮添加吧！' 
                : '📚 家长还没有布置作业哦~'}
            </div>
          )}

          {homeworks.map((hw, index) => (
            <div 
              key={hw.id} 
              className={`sketchy-card p-4 sketchy-enter ${hw.status === 'completed' ? 'bg-[#7CB342]/10' : ''}`}
              style={{ transform: `rotate(${index % 2 === 0 ? -1 : 1}deg)` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* 状态和科目 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`status-sketchy ${getStatusColor(hw.status)}`}>
                      {getStatusText(hw.status)}
                    </span>
                    <span className="text-xs text-[#8D6E63] bg-[#F5E6D3] px-2 py-1 rounded-lg">
                      {hw.subject}
                    </span>
                  </div>
                  
                  {/* 标题 */}
                  <h3 className="text-lg text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                    {hw.status === 'completed' && '✓ '}
                    {hw.title}
                  </h3>
                  
                  {/* 描述 */}
                  {hw.description && (
                    <p className="text-sm text-[#8D6E63] mt-1">{hw.description}</p>
                  )}
                  
                  {/* 时间信息 */}
                  <div className="flex items-center gap-4 mt-2 text-sm text-[#8D6E63]">
                    <Clock className="w-4 h-4" />
                    <span>预计 {hw.estimated_minutes} 分钟</span>
                    {hw.deadline && (
                      <span>截止: {new Date(hw.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                  
                  {/* 分配信息 */}
                  {hw.assigned_profile && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-[#8D6E63]">
                      <GraduationCap className="w-4 h-4" />
                      <span>分配给: {hw.assigned_profile.name}</span>
                    </div>
                  )}
                </div>
                
                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  {profile.role === 'parent' && (
                    <button
                      className="p-2 bg-transparent text-[#EF5350] border-2 border-[#EF5350]/30 rounded-lg hover:bg-[#EF5350]/10 transition-all"
                      onClick={() => handleDeleteHomework(hw.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  {profile.role === 'student' && hw.status === 'pending' && (
                    <button
                      className="px-3 py-2 crayon-button text-[#FFFDE7] flex items-center gap-1 text-sm"
                      onClick={() => handleStartHomework(hw)}
                    >
                      <Play className="w-4 h-4" />
                      开始!
                    </button>
                  )}
                  
                  {profile.role === 'student' && hw.status === 'in_progress' && (
                    <button
                      className="px-3 py-2 crayon-button text-[#FFFDE7] flex items-center gap-1 text-sm"
                      onClick={() => handleCompleteHomework(hw)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      完成!
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 家长端 - 手绘添加按钮 */}
      {profile.role === 'parent' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
          <button
            className="px-6 py-4 crayon-button text-[#FFFDE7] text-lg shadow-lg flex items-center gap-2 hover:animate-bounce"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-5 h-5" />
            添加作业 ✏️
          </button>
        </div>
      )}

      {/* 手绘添加作业对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#FFFDE7] border-2 border-[#5D4037] rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              ✏️ 添加新作业
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                📝 作业标题
              </label>
              <input
                placeholder="如: 完成数学练习册第10页..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full py-3 px-4 pencil-input text-lg"
              />
            </div>
            
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                📚 科目
              </label>
              <Select value={newSubject} onValueChange={setNewSubject}>
                <SelectTrigger className="pencil-input w-full py-3 px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#FFFDE7] border-2 border-[#5D4037]">
                  <SelectItem value="数学">🧮 数学</SelectItem>
                  <SelectItem value="语文">📖 语文</SelectItem>
                  <SelectItem value="英语">🔤 英语</SelectItem>
                  <SelectItem value="科学">🔬 科学</SelectItem>
                  <SelectItem value="其他">📚 其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                📄 描述（可选）
              </label>
              <input
                placeholder="作业详细要求..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full py-3 px-4 pencil-input text-lg"
              />
            </div>
            
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                ⏰ 预计完成时间（分钟）
              </label>
              <input
                type="number"
                placeholder="30"
                value={newEstimatedMinutes}
                onChange={(e) => setNewEstimatedMinutes(parseInt(e.target.value) || 30)}
                className="w-full py-3 px-4 pencil-input text-lg"
              />
            </div>
            
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                🗓️ 截止日期（可选）
              </label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full py-3 px-4 pencil-input text-lg"
              />
            </div>
            
            {students.length > 0 && (
              <div>
                <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                  🎒 分配给（可选）
                </label>
                <Select value={newAssignedTo} onValueChange={setNewAssignedTo}>
                  <SelectTrigger className="pencil-input w-full py-3 px-4">
                    <SelectValue placeholder="选择学生..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FFFDE7] border-2 border-[#5D4037]">
                    <SelectItem value="">不指定</SelectItem>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3 bg-transparent text-[#8D6E63] border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3] transition-all"
                onClick={() => setShowAddDialog(false)}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 crayon-button text-[#FFFDE7] disabled:opacity-50"
                onClick={handleAddHomework}
                disabled={saving || !newTitle}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  '添加 ✓'
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 手绘退出确认对话框 */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="bg-[#FFFDE7] border-2 border-[#5D4037] rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              确认退出？
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-[#8D6E63] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            确定要退出登录吗？
          </p>
          <div className="flex gap-3 mt-6">
            <button
              className="flex-1 py-3 bg-transparent text-[#8D6E63] border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3] transition-all"
              onClick={() => setShowLogoutDialog(false)}
            >
              留下
            </button>
            <button
              className="flex-1 py-3 crayon-button-orange text-[#5D4037]"
              onClick={handleLogout}
            >
              退出
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 创建学生账号对话框 */}
      <Dialog open={showStudentDialog} onOpenChange={setShowStudentDialog}>
        <DialogContent className="bg-[#FFFDE7] border-2 border-[#5D4037] rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              🎒 创建学生账号
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-center text-[#8D6E63] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            为孩子创建一个学生账号，自动加入您的家庭
          </p>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                📧 学生邮箱
              </label>
              <input
                type="email"
                placeholder="student@example.com"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                className="w-full py-3 px-4 pencil-input text-lg"
              />
            </div>
            
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                🔐 密码（至少6位）
              </label>
              <input
                type="password"
                placeholder="设置登录密码..."
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                className="w-full py-3 px-4 pencil-input text-lg"
              />
            </div>
            
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                📝 学生姓名
              </label>
              <input
                placeholder="孩子的名字..."
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full py-3 px-4 pencil-input text-lg"
              />
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3 bg-transparent text-[#8D6E63] border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3] transition-all"
                onClick={() => setShowStudentDialog(false)}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 crayon-button text-[#FFFDE7] disabled:opacity-50"
                onClick={handleCreateStudent}
                disabled={creatingStudent || !studentEmail || !studentPassword || studentPassword.length < 6 || !studentName}
              >
                {creatingStudent ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  '创建 ✓'
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
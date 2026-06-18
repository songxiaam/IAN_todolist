'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Play,
  LogOut,
  GraduationCap,
  X,
  UserPlus,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';

import { APP_ICON } from '@/lib/constants';
import { FocusTimerOverlay } from '@/components/focus-timer-overlay';
import { CompleteHomeworkDialog } from '@/components/complete-homework-dialog';
import { CelebrationOverlay } from '@/components/celebration-overlay';
import { RewardsPanel } from '@/components/rewards-panel';
import { WrongQuestionsPanel } from '@/components/wrong-questions-panel';
import {
  saveFocusTimer,
  loadFocusTimer,
  clearFocusTimer,
  calcRemainingFromStartedAt,
  resolveRemainingSeconds,
} from '@/lib/focus-timer';
import { MAX_CUMULATIVE_PAUSE_SECONDS } from '@/lib/pause-rules';

interface Profile {
  id: string;
  role: 'parent' | 'student';
  family_id: string;
  name: string;
  points_balance?: number;
}

interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'student';
  username?: string | null;
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
  assigned_profile: { id: string; name: string; role: string; username?: string | null } | null;
  points?: number;
  review_status?: string;
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
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [createdStudentInfo, setCreatedStudentInfo] = useState<{ username: string; name: string } | null>(null);
  const [copiedFamilyCode, setCopiedFamilyCode] = useState(false);
  const [filterStudentId, setFilterStudentId] = useState<string>('all');
  const [pausedSecondsUsed, setPausedSecondsUsed] = useState(0);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'homework' | 'rewards' | 'wrong'>('homework');
  const [completingHomework, setCompletingHomework] = useState<Homework | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPoints, setCelebrationPoints] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [newHomeworkPoints, setNewHomeworkPoints] = useState(10);
  const endsAtRef = useRef<number | null>(null);

  const persistFocusTimer = useCallback((
    hw: Homework,
    userId: string,
    remainingSeconds: number,
    running: boolean,
    endsAt: number | null,
    pauseUsed: number,
    pauseStart: number | null,
  ) => {
    saveFocusTimer({
      userId,
      homeworkId: hw.id,
      title: hw.title,
      subject: hw.subject,
      estimatedMinutes: hw.estimated_minutes,
      endsAt,
      remainingSeconds,
      running,
      pausedSecondsUsed: pauseUsed,
      pauseStartedAt: pauseStart,
    });
  }, []);

  const activateFocusTimer = useCallback((
    hw: Homework,
    userId: string,
    options: {
      running: boolean;
      remainingSeconds: number;
      pausedSecondsUsed?: number;
      pauseStartedAt?: number | null;
    },
  ) => {
    const { running, remainingSeconds } = options;
    const pauseUsed = options.pausedSecondsUsed ?? 0;
    const pauseStart = options.pauseStartedAt ?? null;
    const shouldRun = running && remainingSeconds > 0;
    const endsAt = shouldRun ? Date.now() + remainingSeconds * 1000 : null;

    endsAtRef.current = endsAt;
    setCurrentTimer(hw.id);
    setTimerSeconds(remainingSeconds);
    setTimerRunning(shouldRun);
    setPausedSecondsUsed(pauseUsed);
    setPauseStartedAt(pauseStart);
    persistFocusTimer(hw, userId, remainingSeconds, shouldRun, endsAt, pauseUsed, pauseStart);
  }, [persistFocusTimer]);

  const restoreStudentFocusTimer = useCallback((
    userId: string,
    homeworkData: Homework[],
  ) => {
    const stored = loadFocusTimer();
    const inProgress = homeworkData.find((h) => h.status === 'in_progress');

    if (stored && stored.userId === userId) {
      const hw = homeworkData.find((h) => h.id === stored.homeworkId);
      if (hw && hw.status === 'in_progress') {
        const remaining = resolveRemainingSeconds(stored);
        let pauseUsed = stored.pausedSecondsUsed ?? 0;
        let pauseStart = stored.pauseStartedAt ?? null;
        let running = stored.running;

        if (!running && pauseStart) {
          const elapsed = Math.floor((Date.now() - pauseStart) / 1000);
          const total = pauseUsed + elapsed;
          if (total >= MAX_CUMULATIVE_PAUSE_SECONDS) {
            pauseUsed = MAX_CUMULATIVE_PAUSE_SECONDS;
            pauseStart = null;
            running = remaining > 0;
          }
        }

        activateFocusTimer(hw, userId, {
          running,
          remainingSeconds: remaining,
          pausedSecondsUsed: pauseUsed,
          pauseStartedAt: pauseStart,
        });
        return;
      }
      clearFocusTimer();
    }

    if (inProgress) {
      const remaining = inProgress.started_at
        ? calcRemainingFromStartedAt(inProgress.started_at, inProgress.estimated_minutes)
        : inProgress.estimated_minutes * 60;
      activateFocusTimer(inProgress, userId, {
        running: remaining > 0,
        remainingSeconds: remaining,
        pausedSecondsUsed: 0,
        pauseStartedAt: null,
      });
    }
  }, [activateFocusTimer]);

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

  const fetchHomeworks = useCallback(async (
    token: string,
    options?: { assignedTo?: string },
  ) => {
    const params = new URLSearchParams();
    if (options?.assignedTo) {
      params.set('assigned_to', options.assignedTo);
    }
    const query = params.toString();
    const res = await fetch(`/api/homework${query ? `?${query}` : ''}`, {
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
      setPointsBalance(profileData.points_balance ?? 0);
      const homeworkData = await fetchHomeworks(token);
      setHomeworks(homeworkData);
      const members = await fetchFamilyMembers(token);
      setFamilyMembers(members);

      if (profileData.role === 'student') {
        restoreStudentFocusTimer(profileData.id, homeworkData);
      }
    }
    
    setLoading(false);
  }, [fetchProfile, fetchHomeworks, fetchFamilyMembers, router, restoreStudentFocusTimer]);

  useEffect(() => {
    if (!configLoading) {
      loadData();
    }
  }, [configLoading, loadData]);

  // 倒计时逻辑（基于结束时间戳，刷新后仍准确）
  useEffect(() => {
    if (!timerRunning || currentTimer === null) return;

    const interval = setInterval(() => {
      if (!endsAtRef.current) return;
      const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setTimerSeconds(remaining);
      if (remaining <= 0) {
        setTimerRunning(false);
        endsAtRef.current = null;
      }
    }, 250);

    return () => clearInterval(interval);
  }, [timerRunning, currentTimer]);

  // 专注模式：禁止背景滚动
  useEffect(() => {
    if (currentTimer !== null && profile?.role === 'student') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [currentTimer, profile?.role]);

  // 休息满 5 分钟自动继续倒计时
  useEffect(() => {
    if (timerRunning || !pauseStartedAt || currentTimer === null || !profile) return;

    const hw = homeworks.find((h) => h.id === currentTimer);
    if (!hw) return;

    const checkAutoResume = () => {
      const elapsed = Math.floor((Date.now() - pauseStartedAt) / 1000);
      if (pausedSecondsUsed + elapsed < MAX_CUMULATIVE_PAUSE_SECONDS) return;

      const newUsed = MAX_CUMULATIVE_PAUSE_SECONDS;
      const endsAt = Date.now() + timerSeconds * 1000;
      endsAtRef.current = endsAt;
      setPausedSecondsUsed(newUsed);
      setPauseStartedAt(null);
      setTimerRunning(true);
      persistFocusTimer(hw, profile.id, timerSeconds, true, endsAt, newUsed, null);
    };

    checkAutoResume();
    const interval = setInterval(checkAutoResume, 1000);
    return () => clearInterval(interval);
  }, [
    timerRunning,
    pauseStartedAt,
    pausedSecondsUsed,
    timerSeconds,
    currentTimer,
    homeworks,
    profile,
    persistFocusTimer,
  ]);

  // 持久化倒计时状态
  useEffect(() => {
    if (!profile || profile.role !== 'student' || currentTimer === null) return;
    const hw = homeworks.find((h) => h.id === currentTimer);
    if (!hw) return;

    const remaining = endsAtRef.current
      ? Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
      : timerSeconds;

    persistFocusTimer(
      hw,
      profile.id,
      remaining,
      timerRunning,
      endsAtRef.current,
      pausedSecondsUsed,
      pauseStartedAt,
    );
  }, [
    currentTimer,
    timerRunning,
    timerSeconds,
    profile,
    homeworks,
    pausedSecondsUsed,
    pauseStartedAt,
    persistFocusTimer,
  ]);

  const handleLogout = async () => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleAddHomework = async () => {
    if (!newTitle) return;

    const studentList = familyMembers.filter(m => m.role === 'student');
    if (studentList.length > 1 && !newAssignedTo) {
      alert('请选择要分配的学生');
      return;
    }
    
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
        points: newHomeworkPoints,
      })
    });

    if (res.ok) {
      setShowAddDialog(false);
      setNewTitle('');
      setNewDescription('');
      setNewSubject('数学');
      setNewDeadline('');
      setNewEstimatedMinutes(30);
      setNewHomeworkPoints(10);
      setNewAssignedTo(studentList.length === 1 ? studentList[0].id : '');
      loadData();
    } else {
      const data = await res.json();
      alert(data.error || '添加作业失败');
    }

    setSaving(false);
  };

  const openAddDialog = () => {
    const studentList = familyMembers.filter(m => m.role === 'student');
    if (studentList.length === 1) {
      setNewAssignedTo(studentList[0].id);
    } else {
      setNewAssignedTo('');
    }
    setShowAddDialog(true);
  };

  const handleFilterStudent = (studentId: string) => {
    setFilterStudentId(studentId);
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
    if (!studentUsername || !studentPassword || !studentName) return;
    
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
        username: studentUsername,
        password: studentPassword,
        name: studentName,
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      setStudentUsername('');
      setStudentPassword('');
      setStudentName('');
      setCreatedStudentInfo({
        username: data.student.username,
        name: data.student.name,
      });
      loadData();
    } else {
      alert(data.error || '创建学生账号失败');
    }

    setCreatingStudent(false);
  };

  const handleCopyFamilyCode = async () => {
    if (!profile?.family_id) return;
    await navigator.clipboard.writeText(profile.family_id);
    setCopiedFamilyCode(true);
    setTimeout(() => setCopiedFamilyCode(false), 2000);
  };

  const handleStartHomework = async (homework: Homework) => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !profile) return;

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

    const updatedHomework = { ...homework, status: 'in_progress' as const, started_at: now };
    setHomeworks((prev) =>
      prev.map((h) => (h.id === homework.id ? updatedHomework : h)),
    );
    activateFocusTimer(updatedHomework, profile.id, {
      running: true,
      remainingSeconds: homework.estimated_minutes * 60,
      pausedSecondsUsed: 0,
      pauseStartedAt: null,
    });
  };

  const handleResumeFocus = (homework: Homework) => {
    if (!profile) return;
    const remaining = homework.started_at
      ? calcRemainingFromStartedAt(homework.started_at, homework.estimated_minutes)
      : homework.estimated_minutes * 60;
    const stored = loadFocusTimer();
    const pauseUsed = stored?.homeworkId === homework.id ? (stored.pausedSecondsUsed ?? 0) : 0;
    const pauseStart = stored?.homeworkId === homework.id ? (stored.pauseStartedAt ?? null) : null;
    activateFocusTimer(homework, profile.id, {
      running: remaining > 0 && !pauseStart,
      remainingSeconds: remaining,
      pausedSecondsUsed: pauseUsed,
      pauseStartedAt: pauseStart,
    });
  };

  const handlePause = () => {
    if (!profile) return;
    const hw = homeworks.find((h) => h.id === currentTimer);
    if (!hw) return;

    const remaining = endsAtRef.current
      ? Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
      : timerSeconds;
    const pauseStart = Date.now();

    endsAtRef.current = null;
    setTimerSeconds(remaining);
    setTimerRunning(false);
    setPauseStartedAt(pauseStart);
    persistFocusTimer(hw, profile.id, remaining, false, null, pausedSecondsUsed, pauseStart);
  };

  const handleResume = () => {
    if (!profile || !pauseStartedAt) return;
    const hw = homeworks.find((h) => h.id === currentTimer);
    if (!hw) return;

    const elapsed = Math.floor((Date.now() - pauseStartedAt) / 1000);
    const newUsed = Math.min(MAX_CUMULATIVE_PAUSE_SECONDS, pausedSecondsUsed + elapsed);
    const endsAt = Date.now() + timerSeconds * 1000;

    endsAtRef.current = endsAt;
    setPausedSecondsUsed(newUsed);
    setPauseStartedAt(null);
    setTimerRunning(true);
    persistFocusTimer(hw, profile.id, timerSeconds, true, endsAt, newUsed, null);
  };

  const openCompleteDialog = async (homework: Homework) => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setSessionToken(session.access_token);
    setCompletingHomework(homework);
    setShowCompleteDialog(true);
  };

  const handleHomeworkCompleted = (result: { pointsAwarded: number; pointsBalance: number }) => {
    clearFocusTimer();
    endsAtRef.current = null;
    setCurrentTimer(null);
    setTimerRunning(false);
    setTimerSeconds(0);
    setPausedSecondsUsed(0);
    setPauseStartedAt(null);
    setPointsBalance(result.pointsBalance);
    setCelebrationPoints(result.pointsAwarded);
    setShowCelebration(true);
    loadData();
  };

  const handleReviewHomework = async (homeworkId: number, action: 'approve' | 'reject') => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/homework/${homeworkId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session': session.access_token,
      },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      loadData();
    } else {
      const data = await res.json();
      alert(data.error || '审核失败');
    }
  };

  const getReviewText = (status: string) => {
    switch (status) {
      case 'pending': return '⏳ 待审核';
      case 'approved': return '✅ 已通过';
      case 'rejected': return '❌ 未通过';
      default: return '';
    }
  };

  const getReviewColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-[#FFB74D] border-[#FFB74D]';
      case 'approved': return 'text-[#7CB342] border-[#7CB342]';
      case 'rejected': return 'text-[#EF5350] border-[#EF5350]';
      default: return '';
    }
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

  const getStudentStats = (studentId: string) => {
    const list = homeworks.filter(hw => hw.assigned_to === studentId);
    return {
      pending: list.filter(h => h.status === 'pending').length,
      inProgress: list.filter(h => h.status === 'in_progress').length,
      completed: list.filter(h => h.status === 'completed').length,
    };
  };

  const displayHomeworks = profile.role === 'parent' && filterStudentId !== 'all'
    ? homeworks.filter(hw => hw.assigned_to === filterStudentId)
    : homeworks;

  const activeFocusHomework = currentTimer
    ? homeworks.find((h) => h.id === currentTimer)
    : null;
  const storedFocusTimer = currentTimer ? loadFocusTimer() : null;
  const focusTitle = activeFocusHomework?.title ?? storedFocusTimer?.title ?? '作业';
  const focusSubject = activeFocusHomework?.subject ?? storedFocusTimer?.subject ?? '';
  const isStudentFocusMode = profile.role === 'student' && currentTimer !== null && !showCompleteDialog;

  return (
    <div className="min-h-screen paper-bg pb-8">
      {showCelebration && (
        <CelebrationOverlay
          pointsEarned={celebrationPoints}
          onClose={() => setShowCelebration(false)}
        />
      )}

      <CompleteHomeworkDialog
        homework={completingHomework}
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        sessionToken={sessionToken}
        onCompleted={handleHomeworkCompleted}
      />

      {isStudentFocusMode && (
        <FocusTimerOverlay
          title={focusTitle}
          subject={focusSubject}
          timerSeconds={timerSeconds}
          timerRunning={timerRunning}
          pausedSecondsUsed={pausedSecondsUsed}
          pauseStartedAt={pauseStartedAt}
          onPause={handlePause}
          onResume={handleResume}
          onComplete={() => {
            const hw = homeworks.find((h) => h.id === currentTimer);
            if (hw) void openCompleteDialog(hw);
          }}
        />
      )}

      <div className={isStudentFocusMode ? 'pointer-events-none select-none' : undefined}>
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
                {profile.role === 'parent'
                  ? `👨‍👩‍👧 家长端 · ${students.length} 个孩子`
                  : `🎒 ${profile.name} · 🌟 ${pointsBalance} 积分`}
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

      {/* 标签切换 */}
      <div className="max-w-4xl mx-auto px-4 mt-3 flex gap-2">
        <button
          className={`flex-1 py-2 rounded-lg border-2 text-sm transition-all ${
            activeTab === 'homework'
              ? 'crayon-button text-[#FFFDE7] border-transparent'
              : 'bg-transparent text-[#8D6E63] border-[#D7CCC8]'
          }`}
          onClick={() => setActiveTab('homework')}
        >
          📚 作业
        </button>
        <button
          className={`flex-1 py-2 rounded-lg border-2 text-sm transition-all flex items-center justify-center gap-1 ${
            activeTab === 'wrong'
              ? 'crayon-button text-[#FFFDE7] border-transparent'
              : 'bg-transparent text-[#8D6E63] border-[#D7CCC8]'
          }`}
          onClick={() => setActiveTab('wrong')}
        >
          <BookOpen className="w-4 h-4" />
          错题集
        </button>
        <button
          className={`flex-1 py-2 rounded-lg border-2 text-sm transition-all flex items-center justify-center gap-1 ${
            activeTab === 'rewards'
              ? 'crayon-button-orange text-[#5D4037] border-transparent'
              : 'bg-transparent text-[#8D6E63] border-[#D7CCC8]'
          }`}
          onClick={() => setActiveTab('rewards')}
        >
          🎁 {profile.role === 'student' ? `积分 (${pointsBalance})` : '积分'}
        </button>
      </div>

      {activeTab === 'wrong' && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <WrongQuestionsPanel role={profile.role} familyMembers={familyMembers} />
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <RewardsPanel
            role={profile.role}
            familyMembers={familyMembers}
            onPointsChange={setPointsBalance}
          />
        </div>
      )}

      {activeTab === 'homework' && (
      <>
      {profile.role === 'parent' && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          {/* 邀请家长 */}
          <div className="sketchy-card p-4 mb-4 sketchy-enter bg-[#7CB342]/10">
            <h3 className="text-[#5D4037] mb-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              👨‍👩‍👧 邀请其他家长
            </h3>
            <p className="text-sm text-[#8D6E63] mb-3" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              将家庭码发给另一位家长，对方注册后选择「家长 → 加入已有家庭」，即可享有相同的管理权限
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-[#FFFDE7] border-2 border-[#D7CCC8] rounded-lg text-sm text-[#5D4037] break-all">
                {profile.family_id}
              </code>
              <button
                className="px-3 py-2 crayon-button text-[#FFFDE7] text-sm flex items-center gap-1 shrink-0"
                onClick={handleCopyFamilyCode}
              >
                {copiedFamilyCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedFamilyCode ? '已复制' : '复制'}
              </button>
            </div>
          </div>

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
                  {member.role === 'student' && member.username && (
                    <span className="text-xs text-[#8D6E63] ml-1">(@{member.username})</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 按孩子筛选 & 统计 */}
          {students.length > 1 && (
            <div className="sketchy-card p-4 mb-4 sketchy-enter">
              <h3 className="text-[#5D4037] mb-3" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                🎒 按孩子查看
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  className={`px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                    filterStudentId === 'all'
                      ? 'bg-[#7CB342]/20 border-[#7CB342] text-[#5D4037]'
                      : 'bg-[#FFFDE7] border-[#D7CCC8] text-[#8D6E63]'
                  }`}
                  onClick={() => handleFilterStudent('all')}
                  style={{ fontFamily: "'Patrick Hand', cursive" }}
                >
                  全部孩子
                </button>
                {students.map((student) => (
                  <button
                    key={student.id}
                    className={`px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                      filterStudentId === student.id
                        ? 'bg-[#FFB74D]/20 border-[#FFB74D] text-[#5D4037]'
                        : 'bg-[#FFFDE7] border-[#D7CCC8] text-[#8D6E63]'
                    }`}
                    onClick={() => handleFilterStudent(student.id)}
                    style={{ fontFamily: "'Patrick Hand', cursive" }}
                  >
                    {student.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {students.map((student, idx) => {
                  const stats = getStudentStats(student.id);
                  return (
                    <div
                      key={student.id}
                      className={`p-3 rounded-lg border-2 border-[#D7CCC8] bg-[#FFFDE7] transform ${idx % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
                    >
                      <p className="text-[#5D4037] font-medium" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                        🎒 {student.name}
                        {student.username && (
                          <span className="text-xs text-[#8D6E63] ml-1">@{student.username}</span>
                        )}
                      </p>
                      <p className="text-xs text-[#8D6E63] mt-1">
                        待完成 {stats.pending} · 进行中 {stats.inProgress} · 已完成 {stats.completed}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="sketchy-card p-4 text-center transform -rotate-1 sketchy-enter">
              <div className="text-2xl text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {displayHomeworks.filter(h => h.status === 'pending').length}
              </div>
              <div className="text-sm text-[#8D6E63]">📝 待完成</div>
            </div>
            <div className="sketchy-card p-4 text-center transform rotate-1 sketchy-enter bg-[#FFB74D]/20">
              <div className="text-2xl text-[#FFB74D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {displayHomeworks.filter(h => h.status === 'in_progress').length}
              </div>
              <div className="text-sm text-[#8D6E63]">⏳ 进行中</div>
            </div>
            <div className="sketchy-card p-4 text-center transform -rotate-2 sketchy-enter bg-[#7CB342]/20">
              <div className="text-2xl text-[#7CB342]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {displayHomeworks.filter(h => h.status === 'completed').length}
              </div>
              <div className="text-sm text-[#8D6E63]">✅ 已完成</div>
            </div>
          </div>
        </div>
      )}

      {/* 手绘作业列表 */}
      <div className="max-w-4xl mx-auto px-4 mt-4">
        <div className="space-y-3">
          {displayHomeworks.length === 0 && (
            <div className="sketchy-card p-8 text-center text-[#8D6E63]">
              {profile.role === 'parent' 
                ? '📝 还没有作业，点击下方按钮添加吧！' 
                : '📚 家长还没有布置作业哦~'}
            </div>
          )}

          {displayHomeworks.map((hw, index) => (
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
                    {(hw.points ?? 0) > 0 && (
                      <span className="text-xs text-[#FFB74D] bg-[#FFB74D]/20 px-2 py-1 rounded-lg">
                        🌟 {hw.points} 积分
                      </span>
                    )}
                    {hw.status === 'completed' && hw.review_status && hw.review_status !== 'none' && (
                      <span className={`status-sketchy text-xs ${getReviewColor(hw.review_status)}`}>
                        {getReviewText(hw.review_status)}
                      </span>
                    )}
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
                  {hw.assigned_profile ? (
                    <div className="flex items-center gap-2 mt-2 text-sm text-[#8D6E63]">
                      <GraduationCap className="w-4 h-4" />
                      <span>
                        分配给: {hw.assigned_profile.name}
                        {hw.assigned_profile.username && ` (@${hw.assigned_profile.username})`}
                      </span>
                    </div>
                  ) : profile.role === 'parent' ? (
                    <div className="flex items-center gap-2 mt-2 text-sm text-[#EF5350]">
                      <GraduationCap className="w-4 h-4" />
                      <span>未分配学生</span>
                    </div>
                  ) : null}
                </div>
                
                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  {profile.role === 'parent' && hw.status === 'completed' && hw.review_status === 'pending' && (
                    <>
                      <button
                        className="px-2 py-1 text-xs crayon-button text-[#FFFDE7]"
                        onClick={() => handleReviewHomework(hw.id, 'approve')}
                      >
                        通过
                      </button>
                      <button
                        className="px-2 py-1 text-xs border-2 border-[#EF5350] text-[#EF5350] rounded-lg"
                        onClick={() => handleReviewHomework(hw.id, 'reject')}
                      >
                        不通过
                      </button>
                    </>
                  )}

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
                  
                  {profile.role === 'student' && hw.status === 'in_progress' && currentTimer !== hw.id && (
                    <button
                      className="px-3 py-2 crayon-button-orange text-[#5D4037] flex items-center gap-1 text-sm"
                      onClick={() => handleResumeFocus(hw)}
                    >
                      <Play className="w-4 h-4" />
                      继续学习
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
            onClick={openAddDialog}
          >
            <Plus className="w-5 h-5" />
            添加作业 ✏️
          </button>
        </div>
      )}

      </>
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
                🌟 完成奖励积分
              </label>
              <input
                type="number"
                min={0}
                placeholder="10"
                value={newHomeworkPoints}
                onChange={(e) => setNewHomeworkPoints(Math.max(0, parseInt(e.target.value) || 0))}
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
                  🎒 分配给{students.length > 1 ? '（必选）' : ''}
                </label>
                <Select value={newAssignedTo} onValueChange={setNewAssignedTo}>
                  <SelectTrigger className="pencil-input w-full py-3 px-4">
                    <SelectValue placeholder="选择学生..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FFFDE7] border-2 border-[#5D4037]">
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.username ? ` (@${s.username})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {students.length > 1 && (
                  <p className="text-xs text-[#8D6E63] mt-1" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                    多孩家庭请为每个孩子分别布置作业
                  </p>
                )}
              </div>
            )}

            {students.length === 0 && (
              <p className="text-sm text-[#8D6E63] text-center" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                请先创建学生账号，再为孩子布置作业
              </p>
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
                disabled={saving || !newTitle || (students.length > 0 && !newAssignedTo)}
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
      <Dialog open={showStudentDialog} onOpenChange={(open) => {
        setShowStudentDialog(open);
        if (!open) setCreatedStudentInfo(null);
      }}>
        <DialogContent className="bg-[#FFFDE7] border-2 border-[#5D4037] rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              🎒 创建学生账号
            </DialogTitle>
          </DialogHeader>

          {createdStudentInfo ? (
            <div className="space-y-4 mt-2">
              <p className="text-center text-[#7CB342]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                ✅ {createdStudentInfo.name} 的账号已创建！
              </p>
              <div className="sketchy-card p-4 bg-[#F5E6D3]/50 text-center">
                <p className="text-sm text-[#8D6E63]">登录用户名</p>
                <p className="text-xl text-[#5D4037] mt-1" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                  {createdStudentInfo.username}
                </p>
                <p className="text-xs text-[#8D6E63] mt-2">请告诉孩子用此用户名和密码登录</p>
              </div>
              <button
                className="w-full py-3 crayon-button text-[#FFFDE7]"
                onClick={() => {
                  setCreatedStudentInfo(null);
                  setShowStudentDialog(false);
                }}
              >
                知道了
              </button>
            </div>
          ) : (
          <>
          <p className="text-center text-[#8D6E63] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            为孩子创建账号，使用用户名登录，无需邮箱
          </p>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-[#5D4037] mb-2 block" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                👤 登录用户名
              </label>
              <input
                placeholder="例如 xiaoming"
                value={studentUsername}
                onChange={(e) => setStudentUsername(e.target.value)}
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
                disabled={creatingStudent || !studentUsername || !studentPassword || studentPassword.length < 6 || !studentName}
              >
                {creatingStudent ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  '创建 ✓'
                )}
              </button>
            </div>
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
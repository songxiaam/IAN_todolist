'use client';

import { Clock, GraduationCap, Play, Trash2 } from 'lucide-react';

interface HomeworkDetailProps {
  homework: {
    id: number;
    title: string;
    description: string | null;
    subject: string;
    deadline: string | null;
    estimated_minutes: number;
    status: 'pending' | 'in_progress' | 'completed';
    points?: number;
    review_status?: string;
    assigned_profile: { name: string; username?: string | null } | null;
  };
  role: 'parent' | 'student';
  currentTimer: number | null;
  onStart?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  onReview?: (action: 'approve' | 'reject') => void;
  getStatusText: (status: string) => string;
  getStatusColor: (status: string) => string;
  getReviewText: (status: string) => string;
  getReviewColor: (status: string) => string;
}

export function HomeworkDetail({
  homework: hw,
  role,
  currentTimer,
  onStart,
  onResume,
  onDelete,
  onReview,
  getStatusText,
  getStatusColor,
  getReviewText,
  getReviewColor,
}: HomeworkDetailProps) {
  return (
    <div className="space-y-4 pb-4">
      <div className="sketchy-card p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className={`status-sketchy ${getStatusColor(hw.status)}`}>
            {getStatusText(hw.status)}
          </span>
          <span className="rounded-lg bg-[#F5E6D3] px-2 py-1 text-xs text-[#8D6E63]">{hw.subject}</span>
          {(hw.points ?? 0) > 0 && (
            <span className="rounded-lg bg-[#FFB74D]/20 px-2 py-1 text-xs text-[#FFB74D]">
              🌟 {hw.points} 积分
            </span>
          )}
          {hw.status === 'completed' && hw.review_status && hw.review_status !== 'none' && (
            <span className={`status-sketchy text-xs ${getReviewColor(hw.review_status)}`}>
              {getReviewText(hw.review_status)}
            </span>
          )}
        </div>

        <h2 className="text-xl text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          {hw.title}
        </h2>

        {hw.description && (
          <p className="mt-3 text-sm leading-relaxed text-[#8D6E63]">{hw.description}</p>
        )}

        <div className="mt-4 space-y-2 text-sm text-[#8D6E63]">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" />
            <span>预计 {hw.estimated_minutes} 分钟</span>
          </div>
          {hw.deadline && (
            <div className="flex items-center gap-2">
              <span>🗓️ 截止 {new Date(hw.deadline).toLocaleDateString('zh-CN')}</span>
            </div>
          )}
          {hw.assigned_profile && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span>
                {hw.assigned_profile.name}
                {hw.assigned_profile.username && ` (@${hw.assigned_profile.username})`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {role === 'student' && hw.status === 'pending' && onStart && (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 py-3 crayon-button text-[#FFFDE7]"
            onClick={onStart}
          >
            <Play className="h-5 w-5" />
            开始做作业
          </button>
        )}

        {role === 'student' && hw.status === 'in_progress' && currentTimer !== hw.id && onResume && (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 py-3 crayon-button-orange text-[#5D4037]"
            onClick={onResume}
          >
            <Play className="h-5 w-5" />
            继续学习
          </button>
        )}

        {role === 'parent' && hw.status === 'completed' && hw.review_status === 'pending' && onReview && (
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-3 crayon-button text-sm text-[#FFFDE7]"
              onClick={() => onReview('approve')}
            >
              审核通过
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border-2 border-[#EF5350] py-3 text-sm text-[#EF5350]"
              onClick={() => onReview('reject')}
            >
              不通过
            </button>
          </div>
        )}

        {role === 'parent' && onDelete && (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#EF5350]/40 py-2.5 text-sm text-[#EF5350]"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            删除作业
          </button>
        )}
      </div>
    </div>
  );
}

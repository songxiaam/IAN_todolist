'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Trash2,
  ChevronRight,
  Printer,
  CheckSquare,
  Square,
} from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { ImageCropSelector } from '@/components/image-crop-selector';
import { StudentPicker, getDefaultStudentId } from '@/components/student-picker';
import type { NormalizedBBox } from '@/lib/image-crop';
import type { PendingCapture } from '@/components/camera-capture-overlay';
import type { NavOverride } from '@/components/navigation-bar';

interface WrongQuestionItem {
  id: number;
  subject: string;
  image_url: string;
  question_text: string | null;
  student_answer: string | null;
  correct_answer: string | null;
  solution_steps: string | null;
  error_analysis: string | null;
  knowledge_points: string | null;
  mastery_level: number;
  mastered: boolean;
  review_count: number;
  created_at: string;
  student_id: string;
  source_type?: string;
}

const MASTERY_LABELS = ['未掌握', '初步了解', '基本掌握', '完全掌握'];

interface WrongQuestionsPanelProps {
  role: 'parent' | 'student';
  familyMembers: { id: string; name: string; role: string }[];
  pendingCapture?: PendingCapture | null;
  onPendingCaptureConsumed?: () => void;
  onNavOverride?: (nav: NavOverride | null) => void;
}

export function WrongQuestionsPanel({
  role,
  familyMembers,
  pendingCapture,
  onPendingCaptureConsumed,
  onNavOverride,
}: WrongQuestionsPanelProps) {
  const students = familyMembers.filter((m) => m.role === 'student');
  const [selectedStudentId, setSelectedStudentId] = useState(() => getDefaultStudentId(students));
  const [items, setItems] = useState<WrongQuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (role === 'parent' && students.length === 1 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [role, students, selectedStudentId]);

  const handleCancelCrop = useCallback(() => {
    if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
    setCropPreviewUrl(null);
    setCropFile(null);
  }, [cropPreviewUrl]);

  useEffect(() => {
    if (cropPreviewUrl) {
      onNavOverride?.({
        title: '框选错题',
        onBack: handleCancelCrop,
      });
    } else if (selectedItemId !== null) {
      onNavOverride?.({
        title: '错题详情',
        onBack: () => setSelectedItemId(null),
      });
    } else {
      onNavOverride?.(null);
    }
  }, [cropPreviewUrl, selectedItemId, onNavOverride, handleCancelCrop]);

  const getToken = async () => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    return (await supabase.auth.getSession()).data.session?.access_token ?? '';
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    const params = new URLSearchParams();
    if (role === 'parent' && selectedStudentId) {
      params.set('student_id', selectedStudentId);
    }
    const res = await fetch(`/api/wrong-questions?${params}`, {
      headers: { 'x-session': token },
    });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items ?? []);
    setAiConfigured(data.aiConfigured !== false);
    setLoading(false);
  }, [role, selectedStudentId]);

  useEffect(() => {
    setLoading(true);
    setSelectedIds(new Set());
    setSelectedItemId(null);
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!pendingCapture) return;
    if (role === 'parent' && pendingCapture.studentId) {
      setSelectedStudentId(pendingCapture.studentId);
    }
    if (role === 'parent' && !pendingCapture.studentId && students.length > 1) {
      onPendingCaptureConsumed?.();
      return;
    }
    setCropFile(pendingCapture.file);
    setCropPreviewUrl(URL.createObjectURL(pendingCapture.file));
    onPendingCaptureConsumed?.();
  }, [pendingCapture, role, students.length, onPendingCaptureConsumed]);

  const handleConfirmCrop = async (regions: NormalizedBBox[]) => {
    if (!cropFile) return;
    setSubmitting(true);
    const token = await getToken();
    const formData = new FormData();
    formData.append('image', cropFile);
    formData.append('regions', JSON.stringify(regions));
    if (role === 'parent') {
      formData.append('student_id', selectedStudentId);
    }

    const res = await fetch('/api/wrong-questions', {
      method: 'POST',
      headers: { 'x-session': token },
      body: formData,
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      handleCancelCrop();
      loadData();
      alert(`已收录 ${data.count} 道错题`);
    } else {
      alert(data.error || '收录失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除？')) return;
    const token = await getToken();
    await fetch(`/api/wrong-questions/${id}`, {
      method: 'DELETE',
      headers: { 'x-session': token },
    });
    setSelectedItemId(null);
    loadData();
  };

  const handleMastery = async (id: number, level: number) => {
    const token = await getToken();
    await fetch(`/api/wrong-questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ mastery_level: level }),
    });
    loadData();
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrintSheet = async () => {
    if (selectedIds.size === 0) {
      alert('请先勾选错题');
      return;
    }
    setPrinting(true);
    const token = await getToken();
    const res = await fetch('/api/wrong-questions/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ wrong_question_ids: Array.from(selectedIds) }),
    });
    const data = await res.json();
    setPrinting(false);

    if (res.ok) {
      window.open(data.sheet_url, '_blank');
      setSelectedIds(new Set());
      loadData();
    } else {
      alert(data.error || '生成失败');
    }
  };

  const parseKnowledgePoints = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  };

  const getStudentName = (id: string) => students.find((s) => s.id === id)?.name ?? '学生';
  const selectedItem = items.find((i) => i.id === selectedItemId);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  if (cropPreviewUrl) {
    return (
      <div className="pb-4">
        {submitting ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#7CB342]" />
            <p className="text-[#8D6E63]">AI 正在解析选中的错题...</p>
          </div>
        ) : (
          <ImageCropSelector
            imageUrl={cropPreviewUrl}
            onConfirm={handleConfirmCrop}
            onCancel={handleCancelCrop}
            confirmLabel="收录错题"
          />
        )}
      </div>
    );
  }

  if (selectedItem) {
    const kps = parseKnowledgePoints(selectedItem.knowledge_points);
    return (
      <div className="space-y-4 pb-4">
        <img
          src={selectedItem.image_url}
          alt=""
          className="w-full rounded-lg border-2 border-[#D7CCC8]"
        />
        <div className="sketchy-card p-4">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded bg-[#F5E6D3] px-2 py-0.5 text-xs">{selectedItem.subject}</span>
            <span className="text-xs text-[#FFB74D]">
              {MASTERY_LABELS[selectedItem.mastery_level ?? 0]}
            </span>
          </div>
          <p className="text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            {selectedItem.question_text || '（无文字描述）'}
          </p>
        </div>

        {selectedItem.student_answer && (
          <div className="sketchy-card p-4 text-sm">
            <p className="mb-1 text-xs text-[#EF5350]">学生答案</p>
            <p>{selectedItem.student_answer}</p>
          </div>
        )}
        {selectedItem.correct_answer && (
          <div className="sketchy-card p-4 text-sm">
            <p className="mb-1 text-xs text-[#7CB342]">正确答案</p>
            <p>{selectedItem.correct_answer}</p>
          </div>
        )}
        {selectedItem.solution_steps && (
          <div className="sketchy-card bg-[#7CB342]/10 p-4 text-sm">
            <p className="mb-1 text-xs text-[#7CB342]">解析过程</p>
            <p className="whitespace-pre-wrap">{selectedItem.solution_steps}</p>
          </div>
        )}
        {selectedItem.error_analysis && (
          <div className="sketchy-card bg-[#FFB74D]/10 p-4 text-sm">
            <p className="mb-1 text-xs text-[#FFB74D]">错因分析</p>
            <p>{selectedItem.error_analysis}</p>
          </div>
        )}
        {kps.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {kps.map((kp) => (
              <span key={kp} className="rounded bg-[#7CB342]/20 px-2 py-0.5 text-xs">
                {kp}
              </span>
            ))}
          </div>
        )}
        <div>
          <p className="mb-2 text-xs text-[#8D6E63]">掌握程度</p>
          <div className="flex flex-wrap gap-2">
            {MASTERY_LABELS.map((label, level) => (
              <button
                key={label}
                type="button"
                className={`rounded border px-2 py-1 text-xs ${
                  (selectedItem.mastery_level ?? 0) === level
                    ? 'border-[#7CB342] bg-[#7CB342]/20'
                    : 'border-[#D7CCC8]'
                }`}
                onClick={() => handleMastery(selectedItem.id, level)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#EF5350]/40 py-2.5 text-sm text-[#EF5350]"
          onClick={() => handleDelete(selectedItem.id)}
        >
          <Trash2 className="h-4 w-4" />
          删除错题
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {!aiConfigured && (
        <div className="sketchy-card bg-[#EF5350]/10 p-4 text-sm text-[#5D4037]">
          ⚠️ AI 未配置，请设置 DASHSCOPE_API_KEY
        </div>
      )}

      {role === 'parent' && (
        <div className="sketchy-card p-4">
          <StudentPicker
            students={students}
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            label="查看/收录哪位孩子的错题"
          />
        </div>
      )}

      <p className="text-center text-sm text-[#8D6E63]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
        点击下方 + 拍照框选错题
      </p>

      {items.length > 0 && (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 py-2 crayon-button-orange text-[#5D4037] disabled:opacity-50"
          onClick={handlePrintSheet}
          disabled={printing || selectedIds.size === 0}
        >
          {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          生成 A4 练习卷 ({selectedIds.size} 道已选)
        </button>
      )}

      {items.length === 0 ? (
        <div className="sketchy-card p-8 text-center text-[#8D6E63]">
          {role === 'parent' && !selectedStudentId ? '请先选择学生' : '还没有错题，框选添加吧'}
        </div>
      ) : (
        items.map((item) => {
          const selected = selectedIds.has(item.id);
          return (
            <div key={item.id} className="sketchy-card flex items-center gap-3 p-3">
              <button
                type="button"
                className="shrink-0"
                onClick={(e) => toggleSelect(item.id, e)}
              >
                {selected ? (
                  <CheckSquare className="h-5 w-5 text-[#7CB342]" />
                ) : (
                  <Square className="h-5 w-5 text-[#8D6E63]" />
                )}
              </button>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setSelectedItemId(item.id)}
              >
                <img
                  src={item.image_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg border-2 border-[#D7CCC8] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-1">
                    <span className="rounded bg-[#F5E6D3] px-2 py-0.5 text-xs">{item.subject}</span>
                    <span className="text-xs text-[#FFB74D]">
                      {MASTERY_LABELS[item.mastery_level ?? 0]}
                    </span>
                  </div>
                  <p
                    className="line-clamp-2 text-sm text-[#5D4037]"
                    style={{ fontFamily: "'Patrick Hand', cursive" }}
                  >
                    {item.question_text || '（无文字描述）'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#8D6E63]" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

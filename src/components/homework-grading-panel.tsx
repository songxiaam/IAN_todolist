'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, BookMarked, ChevronRight } from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { CropRegionEditor } from '@/components/crop-region-editor';
import { CropRegionsOverview } from '@/components/crop-regions-overview';
import type { CropRegionItem } from '@/components/crop-regions-overview';
import { useCropRegionsSession } from '@/hooks/use-crop-regions-session';
import { StudentPicker, getDefaultStudentId } from '@/components/student-picker';
import type { NormalizedBBox } from '@/lib/image-crop-types';
import type { PendingCapture } from '@/components/camera-capture-overlay';
import type { NavOverride } from '@/components/navigation-bar';

interface GradingQuestion {
  id: number;
  question_index: number;
  crop_image_url: string;
  crop_bbox: string;
  question_text: string | null;
  student_answer: string | null;
  correct_answer: string | null;
  solution_steps: string | null;
  is_correct: boolean | null;
  feedback: string | null;
  wrong_question_id: number | null;
}

interface GradingSession {
  id: number;
  student_id: string;
  subject: string;
  original_image_url: string;
  question_count: number;
  correct_count: number;
  created_at: string;
  grading_questions?: GradingQuestion[];
}

interface HomeworkGradingPanelProps {
  role: 'parent' | 'student';
  familyMembers: { id: string; name: string; role: string }[];
  pendingCapture?: PendingCapture | null;
  onPendingCaptureConsumed?: () => void;
  onNavOverride?: (nav: NavOverride | null) => void;
}

function parseBBox(raw: string): NormalizedBBox {
  try {
    return JSON.parse(raw) as NormalizedBBox;
  } catch {
    return { x: 0.05, y: 0.05, w: 0.9, h: 0.2 };
  }
}

export function HomeworkGradingPanel({
  role,
  familyMembers,
  pendingCapture,
  onPendingCaptureConsumed,
  onNavOverride,
}: HomeworkGradingPanelProps) {
  const students = familyMembers.filter((m) => m.role === 'student');
  const [selectedStudentId, setSelectedStudentId] = useState(() => getDefaultStudentId(students));
  const [sessions, setSessions] = useState<GradingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [detailView, setDetailView] = useState<'cards' | 'regions' | 'editor'>('regions');
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [updatingQuestion, setUpdatingQuestion] = useState(false);

  const handleNavTitle = useCallback(
    (title: string | null, onBack: (() => void) | null) => {
      if (title && onBack) {
        onNavOverride?.({ title, onBack });
      } else if (selectedSessionId !== null) {
        onNavOverride?.({
          title: detailView === 'editor' ? '编辑选区' : '批改详情',
          onBack: () => {
            if (detailView === 'editor') {
              setDetailView('regions');
              setEditingQuestionIndex(null);
            } else {
              setSelectedSessionId(null);
            }
          },
        });
      } else {
        onNavOverride?.(null);
      }
    },
    [onNavOverride, selectedSessionId, detailView],
  );

  const crop = useCropRegionsSession({ onNavTitle: handleNavTitle });

  useEffect(() => {
    if (role === 'parent' && students.length === 1 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [role, students, selectedStudentId]);

  useEffect(() => {
    if (crop.active) return;
    if (selectedSessionId !== null) {
      onNavOverride?.({
        title: detailView === 'editor' ? '编辑选区' : '批改详情',
        onBack: () => {
          if (detailView === 'editor') {
            setDetailView('regions');
            setEditingQuestionIndex(null);
          } else {
            setSelectedSessionId(null);
          }
        },
      });
    } else {
      onNavOverride?.(null);
    }
  }, [selectedSessionId, crop.active, onNavOverride, detailView]);

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
    const res = await fetch(`/api/homework-grading?${params}`, { headers: { 'x-session': token } });
    const data = await res.json();
    if (res.ok) setSessions(data.items ?? []);
    setLoading(false);
  }, [role, selectedStudentId]);

  useEffect(() => {
    setLoading(true);
    setSelectedSessionId(null);
    loadData();
  }, [loadData]);

  const uploadWithRegions = useCallback(
    async (file: File, regions: NormalizedBBox[], studentIdOverride?: string) => {
      const studentId = studentIdOverride ?? selectedStudentId;
      if (role === 'parent' && !studentId) {
        alert('请先选择要关联的学生');
        return;
      }

      setGrading(true);
      const token = await getToken();
      const formData = new FormData();
      formData.append('image', file);
      formData.append('regions', JSON.stringify(regions));
      if (role === 'parent') {
        formData.append('student_id', studentId);
      }

      const res = await fetch('/api/homework-grading', {
        method: 'POST',
        headers: { 'x-session': token },
        body: formData,
      });
      const data = await res.json();
      setGrading(false);

      if (res.ok) {
        crop.cancelSession();
        await loadData();
        setSelectedSessionId(data.id);
        setDetailView('regions');
      } else {
        alert(data.error || '批改失败');
      }
    },
    [role, selectedStudentId, loadData, crop],
  );

  useEffect(() => {
    if (!pendingCapture) return;
    if (role === 'parent' && pendingCapture.studentId) {
      setSelectedStudentId(pendingCapture.studentId);
    }
    if (role === 'parent' && !pendingCapture.studentId && students.length > 1) {
      onPendingCaptureConsumed?.();
      return;
    }
    void (async () => {
      const token = await getToken();
      await crop.startSession(pendingCapture.file, token);
    })();
    onPendingCaptureConsumed?.();
  }, [pendingCapture, role, students.length, onPendingCaptureConsumed]);

  const handleConfirmNewGrading = async () => {
    if (!crop.imageFile) return;
    await uploadWithRegions(crop.imageFile, crop.getRegionBboxes());
  };

  const handleAddToWrong = async (gradingId: number, questionId: number) => {
    setAddingId(questionId);
    const token = await getToken();
    const res = await fetch(
      `/api/homework-grading/${gradingId}/questions/${questionId}/add-to-wrong`,
      { method: 'POST', headers: { 'x-session': token } },
    );
    setAddingId(null);
    if (res.ok) {
      alert('已添加到错题集');
      loadData();
    } else {
      const data = await res.json();
      alert(data.error || '添加失败');
    }
  };

  const getStudentName = (id: string) => students.find((s) => s.id === id)?.name ?? '学生';
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const detailRegions: CropRegionItem[] = useMemo(() => {
    if (!selectedSession?.grading_questions) return [];
    return selectedSession.grading_questions.map((q) => ({
      id: String(q.id),
      bbox: parseBBox(q.crop_bbox),
      previewUrl: q.crop_image_url,
      label: String(q.question_index),
    }));
  }, [selectedSession]);

  const updateQuestionBBox = async (questionId: number, bbox: NormalizedBBox) => {
    if (!selectedSession) return;
    setUpdatingQuestion(true);
    const token = await getToken();
    const res = await fetch(
      `/api/homework-grading/${selectedSession.id}/questions/${questionId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-session': token },
        body: JSON.stringify({ bbox }),
      },
    );
    setUpdatingQuestion(false);
    if (res.ok) {
      await loadData();
      setDetailView('regions');
      setEditingQuestionIndex(null);
    } else {
      const data = await res.json();
      alert(data.error || '更新失败');
    }
  };

  const deleteQuestion = async (index: number) => {
    if (!selectedSession?.grading_questions?.[index]) return;
    if (!confirm('确定删除此题？')) return;
    const question = selectedSession.grading_questions[index];
    const token = await getToken();
    const res = await fetch(
      `/api/homework-grading/${selectedSession.id}/questions/${question.id}`,
      { method: 'DELETE', headers: { 'x-session': token } },
    );
    if (res.ok) {
      await loadData();
      setDetailView('regions');
      setEditingQuestionIndex(null);
    } else {
      const data = await res.json();
      alert(data.error || '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  if (crop.active) {
    if (crop.detecting || grading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-[#7CB342]" />
          <p className="text-[#8D6E63]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            {crop.detecting ? 'AI 正在精确定位题目区域...' : 'AI 正在批改...'}
          </p>
        </div>
      );
    }

    if (crop.view === 'editor' && crop.imageUrl) {
      const editorProps = crop.getEditorProps();
      if (!editorProps) return null;
      return (
        <CropRegionEditor
          imageUrl={crop.imageUrl}
          initialBBox={editorProps.initialBBox}
          regionLabel={editorProps.regionLabel}
          isNew={editorProps.isNew}
          onConfirm={crop.confirmEditor}
          onDelete={editorProps.isNew ? undefined : crop.deleteFromEditor}
          onCancel={crop.closeEditor}
        />
      );
    }

    if (crop.imageUrl) {
      return (
        <CropRegionsOverview
          imageUrl={crop.imageUrl}
          regions={crop.regions}
          onEditRegion={crop.openEditor}
          onAddRegion={() => crop.openEditor('new')}
          onDeleteRegion={crop.deleteRegion}
          onConfirm={handleConfirmNewGrading}
          onCancel={crop.cancelSession}
          confirmLabel="开始批改"
          hint="AI 已自动框选题目，确认后开始批改"
        />
      );
    }
  }

  if (selectedSession) {
    const questions = selectedSession.grading_questions ?? [];

    if (detailView === 'editor' && editingQuestionIndex !== null && questions[editingQuestionIndex]) {
      const q = questions[editingQuestionIndex];
      if (updatingQuestion) {
        return (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#7CB342]" />
            <p className="text-[#8D6E63]">正在更新题目...</p>
          </div>
        );
      }
      return (
        <CropRegionEditor
          imageUrl={selectedSession.original_image_url}
          initialBBox={parseBBox(q.crop_bbox)}
          regionLabel={`第 ${q.question_index} 题`}
          onConfirm={(bbox) => updateQuestionBBox(q.id, bbox)}
          onDelete={() => deleteQuestion(editingQuestionIndex)}
          onCancel={() => {
            setDetailView('regions');
            setEditingQuestionIndex(null);
          }}
        />
      );
    }

    return (
      <div className="space-y-4 pb-4">
        <div className="sketchy-card p-4">
          <p className="text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            {selectedSession.subject} · {selectedSession.correct_count}/{selectedSession.question_count} 正确
          </p>
          <p className="mt-1 text-xs text-[#8D6E63]">
            {role === 'parent' && `${getStudentName(selectedSession.student_id)} · `}
            {new Date(selectedSession.created_at).toLocaleString('zh-CN')}
          </p>
        </div>

        {detailView === 'regions' && (
          <>
            <CropRegionsOverview
              imageUrl={selectedSession.original_image_url}
              regions={detailRegions}
              onEditRegion={(index) => {
                setEditingQuestionIndex(index);
                setDetailView('editor');
              }}
              onAddRegion={() => {
                alert('暂不支持在已有批改中新增题目，请重新拍照批改');
              }}
              onDeleteRegion={deleteQuestion}
              onConfirm={() => setDetailView('cards')}
              onCancel={() => setSelectedSessionId(null)}
              confirmLabel="查看批改结果"
              hint="点击选区可重新框选调整，确认后查看批改详情"
            />
          </>
        )}

        {detailView === 'cards' && (
          <>
            <button
              type="button"
              className="w-full rounded-lg border-2 border-[#D7CCC8] py-2 text-sm text-[#8D6E63]"
              onClick={() => setDetailView('regions')}
            >
              返回框选编辑
            </button>
            {questions.map((q) => (
              <div
                key={q.id}
                className={`rounded-lg border-2 p-3 ${q.is_correct ? 'border-[#7CB342]/50 bg-[#7CB342]/5' : 'border-[#EF5350]/50 bg-[#EF5350]/5'}`}
              >
                <div className="flex gap-3">
                  <button type="button" onClick={() => {
                    setEditingQuestionIndex(questions.indexOf(q));
                    setDetailView('editor');
                  }}>
                    <img
                      src={q.crop_image_url}
                      alt={`第${q.question_index}题`}
                      className="h-24 w-24 shrink-0 rounded border border-[#D7CCC8] object-cover"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-[#5D4037]">第 {q.question_index} 题</span>
                      {q.is_correct ? (
                        <CheckCircle2 className="h-4 w-4 text-[#7CB342]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[#EF5350]" />
                      )}
                    </div>
                    <p className="text-sm text-[#5D4037]">{q.question_text}</p>
                    {q.feedback && <p className="mt-1 text-xs text-[#8D6E63]">{q.feedback}</p>}
                  </div>
                </div>
                {q.solution_steps && (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-[#7CB342]">{q.solution_steps}</p>
                )}
                <button
                  type="button"
                  className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm crayon-button text-[#FFFDE7] disabled:opacity-50"
                  disabled={!!q.wrong_question_id || addingId === q.id}
                  onClick={() => handleAddToWrong(selectedSession.id, q.id)}
                >
                  {addingId === q.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BookMarked className="h-4 w-4" />
                  )}
                  {q.wrong_question_id ? '已在错题集' : '添加到错题集'}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {role === 'parent' && (
        <div className="sketchy-card p-4">
          <StudentPicker
            students={students}
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            label="为哪位孩子批改"
          />
        </div>
      )}

      <p className="text-center text-sm text-[#8D6E63]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
        点击下方 + 拍照批改整页作业
      </p>

      {sessions.length === 0 ? (
        <div className="sketchy-card p-8 text-center text-[#8D6E63]">
          {role === 'parent' && !selectedStudentId ? '请先选择学生' : '还没有批改记录'}
        </div>
      ) : (
        sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className="sketchy-card flex w-full items-center justify-between p-4 text-left active:bg-[#F5E6D3]/30"
            onClick={() => {
              setSelectedSessionId(session.id);
              setDetailView('regions');
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {session.subject} · {session.correct_count}/{session.question_count} 正确
              </p>
              <p className="text-xs text-[#8D6E63]">
                {role === 'parent' && `${getStudentName(session.student_id)} · `}
                {new Date(session.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#8D6E63]" />
          </button>
        ))
      )}
    </div>
  );
}

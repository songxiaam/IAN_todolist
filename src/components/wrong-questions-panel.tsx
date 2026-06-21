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
import { CropRegionEditor } from '@/components/crop-region-editor';
import { CropRegionsOverview } from '@/components/crop-regions-overview';
import { WrongQuestionCropImage } from '@/components/wrong-question-crop-image';
import { WrongQuestionSourceViewer } from '@/components/wrong-question-source-viewer';
import { useNormalizedImageUrl } from '@/hooks/use-normalized-image-url';
import { useCropRegionsSession } from '@/hooks/use-crop-regions-session';
import { StudentPicker, getDefaultStudentId } from '@/components/student-picker';
import type { NormalizedBBox } from '@/lib/image-crop-types';
import type { PendingCapture } from '@/components/camera-capture-overlay';
import type { NavOverride } from '@/components/navigation-bar';

interface WrongQuestionItem {
  id: number;
  subject: string;
  original_image_url: string | null;
  crop_bbox: NormalizedBBox | null;
  legacy_image_url?: string | null;
  image_url?: string | null;
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

type DetailView = 'info' | 'source' | 'editor';

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
  const [detailView, setDetailView] = useState<DetailView>('info');
  const [updatingBbox, setUpdatingBbox] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);

  const handleCropNavTitle = useCallback(
    (title: string | null, onBack: (() => void) | null) => {
      if (title && onBack) {
        onNavOverride?.({ title, onBack });
      }
    },
    [onNavOverride],
  );

  const crop = useCropRegionsSession({ onNavTitle: handleCropNavTitle });

  const closeDetail = useCallback(() => {
    setSelectedItemId(null);
    setDetailView('info');
  }, []);

  useEffect(() => {
    if (crop.active) return;

    if (selectedItemId !== null) {
      if (detailView === 'editor') {
        onNavOverride?.({
          title: '重新框选',
          onBack: () => setDetailView('source'),
        });
      } else if (detailView === 'source') {
        onNavOverride?.({
          title: '原始试卷',
          onBack: () => setDetailView('info'),
        });
      } else {
        onNavOverride?.({
          title: '错题详情',
          onBack: closeDetail,
        });
      }
    } else if (!crop.active) {
      onNavOverride?.(null);
    }
  }, [selectedItemId, detailView, crop.active, onNavOverride, closeDetail]);

  useEffect(() => {
    if (role === 'parent' && students.length === 1 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [role, students, selectedStudentId]);

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
    setDetailView('info');
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
    void (async () => {
      const token = await getToken();
      await crop.startSession(pendingCapture.file, token);
    })();
    onPendingCaptureConsumed?.();
  }, [pendingCapture, role, students.length, onPendingCaptureConsumed]);

  const handleConfirmCrop = async () => {
    if (!crop.imageFile) return;
    setSubmitting(true);
    const token = await getToken();
    const formData = new FormData();
    formData.append('image', crop.imageFile);
    formData.append('regions', JSON.stringify(crop.getRegionBboxes()));
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
      crop.cancelSession();
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
    closeDetail();
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

  const handleUpdateBbox = async (id: number, bbox: NormalizedBBox) => {
    setUpdatingBbox(true);
    const token = await getToken();
    const res = await fetch(`/api/wrong-questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ bbox, reanalyze: true }),
    });
    setUpdatingBbox(false);
    if (res.ok) {
      await loadData();
      setDetailView('info');
    } else {
      const data = await res.json();
      alert(data.error || '更新失败');
    }
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

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const { displayUrl: normalizedOriginalUrl, loading: normalizingOriginal } =
    useNormalizedImageUrl(selectedItem?.original_image_url);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  if (crop.active) {
    if (crop.detecting || submitting) {
      return (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-[#7CB342]" />
          <p className="text-[#8D6E63]">
            {crop.detecting ? 'AI 正在精确定位题目区域...' : 'AI 正在解析选中的错题...'}
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
          onConfirm={handleConfirmCrop}
          onCancel={crop.cancelSession}
          confirmLabel="收录错题"
          hint="AI 已自动框选题目，点击选区可编辑调整"
        />
      );
    }
  }

  if (selectedItem) {
    const kps = parseKnowledgePoints(selectedItem.knowledge_points);
    const canViewSource = Boolean(selectedItem.original_image_url && selectedItem.crop_bbox);

    if (detailView === 'editor' && canViewSource && selectedItem.crop_bbox) {
      if (updatingBbox || normalizingOriginal || !normalizedOriginalUrl) {
        return (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#7CB342]" />
            <p className="text-[#8D6E63]">
              {updatingBbox ? '正在更新框选并重新解析...' : '正在加载原图...'}
            </p>
          </div>
        );
      }
      return (
        <CropRegionEditor
          imageUrl={normalizedOriginalUrl}
          initialBBox={selectedItem.crop_bbox}
          regionLabel="错题选区"
          onConfirm={(bbox) => handleUpdateBbox(selectedItem.id, bbox)}
          onCancel={() => setDetailView('source')}
        />
      );
    }

    if (detailView === 'source' && canViewSource && selectedItem.crop_bbox) {
      if (normalizingOriginal || !normalizedOriginalUrl) {
        return (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#7CB342]" />
            <p className="text-[#8D6E63]">正在加载原图...</p>
          </div>
        );
      }
      return (
        <WrongQuestionSourceViewer
          imageUrl={normalizedOriginalUrl}
          bbox={selectedItem.crop_bbox}
          onRecrop={() => setDetailView('editor')}
        />
      );
    }

    return (
      <div className="space-y-4 pb-4">
        <WrongQuestionCropImage
          originalImageUrl={selectedItem.original_image_url}
          cropBbox={selectedItem.crop_bbox}
          legacyImageUrl={selectedItem.legacy_image_url ?? selectedItem.image_url}
          alt=""
          className="w-full rounded-lg border-2 border-[#D7CCC8] object-contain"
          onClick={canViewSource ? () => setDetailView('source') : undefined}
        />
        {canViewSource && (
          <p className="text-center text-xs text-[#8D6E63]">点击图片查看原始试卷并重新框选</p>
        )}
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
                onClick={() => {
                  setSelectedItemId(item.id);
                  setDetailView('info');
                }}
              >
                <WrongQuestionCropImage
                  originalImageUrl={item.original_image_url}
                  cropBbox={item.crop_bbox}
                  legacyImageUrl={item.legacy_image_url ?? item.image_url}
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

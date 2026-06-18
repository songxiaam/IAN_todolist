'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Loader2,
  Trash2,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';

interface WrongQuestionItem {
  id: number;
  subject: string;
  image_url: string;
  question_text: string | null;
  student_answer: string | null;
  correct_answer: string | null;
  error_analysis: string | null;
  knowledge_points: string | null;
  mastered: boolean;
  review_count: number;
  created_at: string;
  student_id: string;
}

interface PracticeItem {
  id: number;
  question_text: string;
  question_type: string;
  options: string | null;
  answer: string;
  explanation: string | null;
  student_answer: string | null;
  is_correct: boolean | null;
}

interface WrongQuestionsPanelProps {
  role: 'parent' | 'student';
  familyMembers: { id: string; name: string; role: string }[];
}

export function WrongQuestionsPanel({ role, familyMembers }: WrongQuestionsPanelProps) {
  const [items, setItems] = useState<WrongQuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [filterStudentId, setFilterStudentId] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [practiceMap, setPracticeMap] = useState<Record<number, PracticeItem[]>>({});
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [answerInputs, setAnswerInputs] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const students = familyMembers.filter((m) => m.role === 'student');

  const getToken = async () => {
    const supabase = await getSupabaseBrowserClientWithRetry();
    return (await supabase.auth.getSession()).data.session?.access_token ?? '';
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const params = new URLSearchParams();
    if (role === 'parent' && filterStudentId !== 'all') {
      params.set('student_id', filterStudentId);
    }

    const res = await fetch(`/api/wrong-questions?${params}`, {
      headers: { 'x-session': token },
    });
    const data = await res.json();

    if (res.ok) {
      setItems(data.items ?? []);
      setAiConfigured(data.aiConfigured !== false);
    }
    setLoading(false);
  }, [role, filterStudentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAnalyzing(true);
    const token = await getToken();
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/wrong-questions', {
      method: 'POST',
      headers: { 'x-session': token },
      body: formData,
    });

    const data = await res.json();
    setAnalyzing(false);

    if (res.ok) {
      setExpandedId(data.id);
      loadData();
    } else {
      alert(data.error || '收录失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这道错题吗？')) return;
    const token = await getToken();
    const res = await fetch(`/api/wrong-questions/${id}`, {
      method: 'DELETE',
      headers: { 'x-session': token },
    });
    if (res.ok) {
      if (expandedId === id) setExpandedId(null);
      loadData();
    } else {
      const data = await res.json();
      alert(data.error || '删除失败');
    }
  };

  const handleToggleMastered = async (item: WrongQuestionItem) => {
    const token = await getToken();
    await fetch(`/api/wrong-questions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-session': token },
      body: JSON.stringify({ mastered: !item.mastered }),
    });
    loadData();
  };

  const loadPractice = async (wrongQuestionId: number) => {
    const token = await getToken();
    const res = await fetch(`/api/wrong-questions/${wrongQuestionId}/practice`, {
      headers: { 'x-session': token },
    });
    if (res.ok) {
      const data = await res.json();
      setPracticeMap((prev) => ({ ...prev, [wrongQuestionId]: data }));
    }
  };

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!practiceMap[id]) {
      await loadPractice(id);
    }
  };

  const handleGeneratePractice = async (wrongQuestionId: number) => {
    setGeneratingId(wrongQuestionId);
    const token = await getToken();
    const res = await fetch(`/api/wrong-questions/${wrongQuestionId}/practice`, {
      method: 'POST',
      headers: { 'x-session': token },
    });
    setGeneratingId(null);

    if (res.ok) {
      const data = await res.json();
      setPracticeMap((prev) => ({
        ...prev,
        [wrongQuestionId]: [...(prev[wrongQuestionId] ?? []), ...data],
      }));
      loadData();
    } else {
      const data = await res.json();
      alert(data.error || '生成失败');
    }
  };

  const handleSubmitAnswer = async (wrongQuestionId: number, practiceId: number) => {
    const answer = answerInputs[practiceId]?.trim();
    if (!answer) return;

    setSubmittingId(practiceId);
    const token = await getToken();
    const res = await fetch(
      `/api/wrong-questions/${wrongQuestionId}/practice/${practiceId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-session': token },
        body: JSON.stringify({ student_answer: answer }),
      },
    );
    const data = await res.json();
    setSubmittingId(null);

    if (res.ok) {
      setPracticeMap((prev) => ({
        ...prev,
        [wrongQuestionId]: (prev[wrongQuestionId] ?? []).map((p) =>
          p.id === practiceId ? data.practice : p,
        ),
      }));
      if (!data.is_correct) {
        alert(`答错了～\n正确答案：${data.correct_answer}\n\n${data.explanation || ''}`);
      }
    } else {
      alert(data.error || '提交失败');
    }
  };

  const getStudentName = (id: string) =>
    students.find((s) => s.id === id)?.name ?? '学生';

  const parseKnowledgePoints = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  };

  const parseOptions = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#7CB342]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!aiConfigured && (
        <div className="sketchy-card p-4 bg-[#EF5350]/10 border-2 border-[#EF5350]/30">
          <p className="text-sm text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            ⚠️ AI 未配置，无法拍照解析错题。请在服务端设置 AI_API_BASE_URL 和 AI_API_KEY。
          </p>
        </div>
      )}

      {role === 'student' && (
        <div className="sketchy-card p-4 text-center">
          <p className="text-sm text-[#8D6E63] mb-3" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            拍一道错题，AI 帮你分析错因并收录
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapture}
          />
          <button
            className="w-full py-3 crayon-button-orange text-[#5D4037] flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
            disabled={analyzing || !aiConfigured}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                AI 正在解析错题...
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                拍照收录错题
              </>
            )}
          </button>
        </div>
      )}

      {role === 'parent' && students.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-2 rounded-lg border-2 text-sm ${
              filterStudentId === 'all'
                ? 'bg-[#7CB342]/20 border-[#7CB342]'
                : 'border-[#D7CCC8]'
            }`}
            onClick={() => setFilterStudentId('all')}
          >
            全部
          </button>
          {students.map((s) => (
            <button
              key={s.id}
              className={`px-3 py-2 rounded-lg border-2 text-sm ${
                filterStudentId === s.id
                  ? 'bg-[#FFB74D]/20 border-[#FFB74D]'
                  : 'border-[#D7CCC8]'
              }`}
              onClick={() => setFilterStudentId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="sketchy-card p-8 text-center text-[#8D6E63]">
          {role === 'student' ? '📝 还没有错题，拍一张开始收录吧！' : '📚 孩子还没有收录错题'}
        </div>
      ) : (
        items.map((item, index) => {
          const expanded = expandedId === item.id;
          const practices = practiceMap[item.id] ?? [];
          const kps = parseKnowledgePoints(item.knowledge_points);

          return (
            <div
              key={item.id}
              className={`sketchy-card p-4 sketchy-enter ${item.mastered ? 'bg-[#7CB342]/10' : ''}`}
              style={{ transform: `rotate(${index % 2 === 0 ? -1 : 1}deg)` }}
            >
              <div className="flex gap-3">
                <img
                  src={item.image_url}
                  alt="错题"
                  className="w-20 h-20 object-cover rounded-lg border-2 border-[#D7CCC8] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs bg-[#F5E6D3] px-2 py-0.5 rounded">{item.subject}</span>
                    {item.mastered && (
                      <span className="text-xs text-[#7CB342]">✅ 已掌握</span>
                    )}
                    {role === 'parent' && (
                      <span className="text-xs text-[#8D6E63]">{getStudentName(item.student_id)}</span>
                    )}
                    <span className="text-xs text-[#8D6E63]">复习 {item.review_count} 次</span>
                  </div>
                  <p
                    className="text-[#5D4037] line-clamp-2"
                    style={{ fontFamily: "'Patrick Hand', cursive" }}
                  >
                    {item.question_text || '（AI 解析中...）'}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    className="p-1.5 text-[#8D6E63]"
                    onClick={() => handleExpand(item.id)}
                  >
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    className="p-1.5 text-[#EF5350]"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-[#D7CCC8] space-y-3">
                  {item.student_answer && (
                    <div>
                      <p className="text-xs text-[#EF5350] mb-1">你的答案</p>
                      <p className="text-sm text-[#5D4037]">{item.student_answer}</p>
                    </div>
                  )}
                  {item.correct_answer && (
                    <div>
                      <p className="text-xs text-[#7CB342] mb-1">正确答案</p>
                      <p className="text-sm text-[#5D4037]">{item.correct_answer}</p>
                    </div>
                  )}
                  {item.error_analysis && (
                    <div className="bg-[#FFB74D]/10 p-3 rounded-lg">
                      <p className="text-xs text-[#FFB74D] mb-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> 错因分析
                      </p>
                      <p className="text-sm text-[#5D4037]">{item.error_analysis}</p>
                    </div>
                  )}
                  {kps.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {kps.map((kp) => (
                        <span key={kp} className="text-xs px-2 py-0.5 bg-[#7CB342]/20 rounded">
                          {kp}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {role === 'student' && (
                      <>
                        <button
                          className="px-3 py-2 crayon-button text-[#FFFDE7] text-sm flex items-center gap-1 disabled:opacity-50"
                          onClick={() => handleGeneratePractice(item.id)}
                          disabled={generatingId === item.id || !aiConfigured}
                        >
                          {generatingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          生成类似题
                        </button>
                        <button
                          className={`px-3 py-2 text-sm border-2 rounded-lg ${
                            item.mastered
                              ? 'border-[#7CB342] text-[#7CB342]'
                              : 'border-[#D7CCC8] text-[#8D6E63]'
                          }`}
                          onClick={() => handleToggleMastered(item)}
                        >
                          {item.mastered ? '取消掌握' : '标记已掌握'}
                        </button>
                      </>
                    )}
                  </div>

                  {practices.length > 0 && (
                    <div className="space-y-3 mt-2">
                      <p className="text-sm text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                        ✏️ 巩固练习
                      </p>
                      {practices.map((p, pi) => {
                        const options = parseOptions(p.options);
                        const answered = p.is_correct !== null;

                        return (
                          <div
                            key={p.id}
                            className={`p-3 rounded-lg border-2 ${
                              answered
                                ? p.is_correct
                                  ? 'border-[#7CB342] bg-[#7CB342]/10'
                                  : 'border-[#EF5350] bg-[#EF5350]/10'
                                : 'border-[#D7CCC8] bg-[#FFFDE7]'
                            }`}
                          >
                            <p className="text-sm text-[#5D4037] mb-2">
                              {pi + 1}. {p.question_text}
                            </p>
                            {options.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {options.map((opt) => (
                                  <button
                                    key={opt}
                                    className={`block w-full text-left text-sm px-2 py-1 rounded ${
                                      answerInputs[p.id] === opt
                                        ? 'bg-[#FFB74D]/30'
                                        : 'hover:bg-[#F5E6D3]'
                                    }`}
                                    onClick={() =>
                                      !answered &&
                                      setAnswerInputs((prev) => ({ ...prev, [p.id]: opt }))
                                    }
                                    disabled={answered || role !== 'student'}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            )}
                            {role === 'student' && !answered && (
                              <div className="flex gap-2">
                                {options.length === 0 && (
                                  <input
                                    placeholder="写下你的答案..."
                                    value={answerInputs[p.id] ?? ''}
                                    onChange={(e) =>
                                      setAnswerInputs((prev) => ({
                                        ...prev,
                                        [p.id]: e.target.value,
                                      }))
                                    }
                                    className="flex-1 py-1 px-2 pencil-input text-sm"
                                  />
                                )}
                                <button
                                  className="px-3 py-1 crayon-button text-[#FFFDE7] text-sm disabled:opacity-50"
                                  onClick={() => handleSubmitAnswer(item.id, p.id)}
                                  disabled={submittingId === p.id || !answerInputs[p.id]?.trim()}
                                >
                                  {submittingId === p.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    '提交'
                                  )}
                                </button>
                              </div>
                            )}
                            {answered && (
                              <div className="flex items-center gap-2 text-sm mt-1">
                                {p.is_correct ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#7CB342]" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-[#EF5350]" />
                                )}
                                <span className={p.is_correct ? 'text-[#7CB342]' : 'text-[#EF5350]'}>
                                  {p.is_correct ? '答对了！' : `答错了，正确：${p.answer}`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

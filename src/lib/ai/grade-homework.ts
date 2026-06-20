import { chatCompletion, imageMessagePart, parseJson } from './client';
import { resolveModelRef } from './model-config';
import { ALL_SUBJECT_LABELS, normalizeSubjectKey, subjectKeyToLabel } from './subjects';
import type { NormalizedBBox } from '@/lib/image-crop';

export interface GradedQuestionItem {
  index: number;
  bbox: NormalizedBBox;
  question_text: string;
  student_answer: string;
  correct_answer: string;
  solution_steps: string;
  is_correct: boolean;
  feedback: string;
}

export interface HomeworkGradeResult {
  subject: string;
  questions: GradedQuestionItem[];
}

const GRADE_PROMPT = `你是 K12 作业批改助手。请分析这张作业照片，识别每一道题，并给出批改结果。
要求：
1. 按从上到下顺序列出所有能识别的题目
2. bbox 为题目区域在图片中的相对位置，取值 0~1（x,y 为左上角，w,h 为宽高）
3. question_text 必须完整文字化，便于下次无需再看图片
4. 忠实记录学生手写答案，不要擅自修改
5. 若无法判断对错，is_correct 设为 null 的题不要返回，尽量给出判断

请严格返回 JSON（不要 markdown）：
{
  "subject": "科目（${ALL_SUBJECT_LABELS.join('/')}）",
  "questions": [
    {
      "index": 1,
      "bbox": { "x": 0.05, "y": 0.1, "w": 0.9, "h": 0.12 },
      "question_text": "题目文字描述",
      "student_answer": "学生答案",
      "correct_answer": "正确答案",
      "solution_steps": "解题步骤与解析",
      "is_correct": true,
      "feedback": "简短评语"
    }
  ]
}`;

async function gradeHomeworkImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<HomeworkGradeResult> {
  const resolved = resolveModelRef('vision_analyze', 'other');
  if (!resolved) {
    throw new Error('未配置作业批改视觉模型（vision_analyze）');
  }

  const content = await chatCompletion(
    resolved,
    [
      {
        role: 'user',
        content: [{ type: 'text', text: GRADE_PROMPT }, imageMessagePart(imageBuffer, mimeType)],
      },
    ],
    true,
  );

  const parsed = parseJson<{
    subject?: string;
    questions?: Array<{
      index?: number;
      bbox?: NormalizedBBox;
      question_text?: string;
      student_answer?: string;
      correct_answer?: string;
      solution_steps?: string;
      is_correct?: boolean;
      feedback?: string;
    }>;
  }>(content);

  const subjectKey = normalizeSubjectKey(parsed.subject ?? '其他');
  const questions = (parsed.questions ?? [])
    .filter((q) => q.bbox && q.question_text)
    .map((q, i) => ({
      index: q.index ?? i + 1,
      bbox: {
        x: Number(q.bbox!.x) || 0,
        y: Number(q.bbox!.y) || 0,
        w: Number(q.bbox!.w) || 0.9,
        h: Number(q.bbox!.h) || 0.1,
      },
      question_text: q.question_text || '',
      student_answer: q.student_answer || '',
      correct_answer: q.correct_answer || '',
      solution_steps: q.solution_steps || '',
      is_correct: Boolean(q.is_correct),
      feedback: q.feedback || '',
    }));

  return {
    subject: subjectKeyToLabel(subjectKey),
    questions,
  };
}

export { gradeHomeworkImage };

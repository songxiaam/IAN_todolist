import { chatCompletion, imageMessagePart, parseJson } from './client';
import { resolveModelRef } from './model-config';
import { ALL_SUBJECT_LABELS, normalizeSubjectKey, subjectKeyToLabel } from './subjects';
import { refineAlignedBboxes, normalizeRawBBox } from '@/lib/bbox-utils';
import type { NormalizedBBox } from '@/lib/image-crop-types';

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
2. bbox 为单题区域相对位置 0~1（x,y 左上角，w,h 宽高）；一题一框，上下边界尽量贴题号与作答区，不要裁切文字
3. 单题时 h 不超过 0.35；多题按从上到下排列，相邻题边界可在空白处相接
4. question_text 必须完整文字化，便于下次无需再看图片
5. 忠实记录学生手写答案，不要擅自修改
6. 若无法判断对错，is_correct 设为 null 的题不要返回，尽量给出判断

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
  const mapped = (parsed.questions ?? [])
    .filter((q) => q.bbox && q.question_text)
    .map((q, i) => ({
      index: q.index ?? i + 1,
      bbox: normalizeRawBBox(q.bbox!),
      question_text: q.question_text || '',
      student_answer: q.student_answer || '',
      correct_answer: q.correct_answer || '',
      solution_steps: q.solution_steps || '',
      is_correct: Boolean(q.is_correct),
      feedback: q.feedback || '',
    }));

  const refinedBboxes = refineAlignedBboxes(mapped.map((q) => q.bbox));
  const questions = mapped.map((q, i) => ({
    ...q,
    bbox: refinedBboxes[i] ?? q.bbox,
  }));

  return {
    subject: subjectKeyToLabel(subjectKey),
    questions,
  };
}

const GRADE_CROP_PROMPT = `你是 K12 作业批改助手。请分析这张题目截图，给出批改结果。
要求：
1. question_text 必须完整文字化
2. 忠实记录学生手写答案，不要擅自修改
3. 尽量给出对错判断

请严格返回 JSON（不要 markdown）：
{
  "subject": "科目（${ALL_SUBJECT_LABELS.join('/')}）",
  "question_text": "题目文字描述",
  "student_answer": "学生答案",
  "correct_answer": "正确答案",
  "solution_steps": "解题步骤与解析",
  "is_correct": true,
  "feedback": "简短评语"
}`;

async function gradeQuestionCrop(
  cropBuffer: Buffer,
  mimeType: string,
  subjectHint?: string,
): Promise<Omit<GradedQuestionItem, 'index' | 'bbox'> & { subjectLabel: string }> {
  const resolved = resolveModelRef('vision_analyze', 'other');
  if (!resolved) {
    throw new Error('未配置作业批改视觉模型（vision_analyze）');
  }

  const hint = subjectHint ? `\n科目参考：${subjectHint}` : '';
  const content = await chatCompletion(
    resolved,
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: GRADE_CROP_PROMPT + hint },
          imageMessagePart(cropBuffer, mimeType),
        ],
      },
    ],
    true,
  );

  const parsed = parseJson<{
    subject?: string;
    question_text?: string;
    student_answer?: string;
    correct_answer?: string;
    solution_steps?: string;
    is_correct?: boolean;
    feedback?: string;
  }>(content);

  const subjectKey = normalizeSubjectKey(parsed.subject ?? subjectHint ?? '其他');

  return {
    subjectLabel: subjectKeyToLabel(subjectKey),
    question_text: parsed.question_text || '',
    student_answer: parsed.student_answer || '',
    correct_answer: parsed.correct_answer || '',
    solution_steps: parsed.solution_steps || '',
    is_correct: Boolean(parsed.is_correct),
    feedback: parsed.feedback || '',
  };
}

async function gradeHomeworkFromRegions(
  sourceBuffer: Buffer,
  mimeType: string,
  regions: NormalizedBBox[],
): Promise<HomeworkGradeResult> {
  const { cropImageBuffer } = await import('@/lib/image-crop');
  let subject = '其他';
  const questions: GradedQuestionItem[] = [];

  for (let i = 0; i < regions.length; i++) {
    const bbox = regions[i];
    const cropBuffer = await cropImageBuffer(sourceBuffer, bbox);
    const graded = await gradeQuestionCrop(cropBuffer, 'image/jpeg');
    if (graded.subjectLabel) {
      subject = graded.subjectLabel;
    }
    questions.push({
      index: i + 1,
      bbox,
      question_text: graded.question_text,
      student_answer: graded.student_answer,
      correct_answer: graded.correct_answer,
      solution_steps: graded.solution_steps,
      is_correct: graded.is_correct,
      feedback: graded.feedback,
    });
  }

  return { subject, questions };
}

export { gradeHomeworkImage, gradeQuestionCrop, gradeHomeworkFromRegions };

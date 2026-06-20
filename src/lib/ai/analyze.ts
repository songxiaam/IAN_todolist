import { chatCompletion, imageMessagePart, parseJson } from './client';
import { resolveModelRef } from './model-config';
import {
  ALL_SUBJECT_LABELS,
  normalizeSubjectKey,
  subjectKeyToLabel,
} from './subjects';
import type {
  AiCapability,
  AiSubjectKey,
  GeneratedPracticeQuestion,
  WrongQuestionAnalysis,
} from './types';

const SUBJECT_DETECT_PROMPT = `你是 K12 教辅助手。请根据图片判断这道错题属于哪个学科。
只能从以下列表中选一个最匹配的：${ALL_SUBJECT_LABELS.join('、')}。
请严格返回 JSON（不要 markdown）：
{"subject": "科目名称", "confidence": "high/medium/low", "reason": "一句话说明判断依据"}`;

const ANALYZE_PROMPT = (subjectHint: string) =>
  `你是一位耐心的小学/初中/高中辅导老师，擅长${subjectHint}学科。
请分析图片中的错题，用中文回答。务必忠实还原学生手写内容，不要擅自把错误答案改成正确答案。
请严格返回 JSON 格式（不要 markdown 代码块）：
{
  "subject": "科目（${ALL_SUBJECT_LABELS.join('/')}）",
  "question": "题目完整内容（尽量还原题干，公式用 LaTeX）",
  "student_answer": "学生写的答案（看不清则写「未识别」，不要纠正）",
  "correct_answer": "正确答案及简要解题步骤",
  "error_analysis": "错因分析，指出学生哪里做错了，用孩子能懂的语言",
  "knowledge_points": ["知识点1", "知识点2"]
}`;

async function detectSubjectFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<{ subjectKey: AiSubjectKey; subjectLabel: string; model: string }> {
  const resolved = resolveModelRef('subject_detect', 'other');
  if (!resolved) {
    throw new Error('未配置学科识别模型（subject_detect）');
  }

  const content = await chatCompletion(
    resolved,
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: SUBJECT_DETECT_PROMPT },
          imageMessagePart(imageBuffer, mimeType),
        ],
      },
    ],
    true,
  );

  const parsed = parseJson<{ subject?: string }>(content);
  const subjectKey = normalizeSubjectKey(parsed.subject ?? '其他');
  return {
    subjectKey,
    subjectLabel: subjectKeyToLabel(subjectKey),
    model: `${resolved.provider}:${resolved.model}`,
  };
}

async function analyzeWrongQuestionCrop(
  cropBuffer: Buffer,
  mimeType: string,
  subjectHint?: string,
): Promise<WrongQuestionAnalysis> {
  const subjectKey = subjectHint ? normalizeSubjectKey(subjectHint) : 'other';
  const label = subjectHint ? subjectKeyToLabel(subjectKey) : '综合';

  const visionResolved = resolveModelRef('vision_analyze', subjectKey);
  if (!visionResolved) {
    throw new Error('未配置题目理解模型（vision_analyze）');
  }

  const content = await chatCompletion(
    visionResolved,
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: ANALYZE_PROMPT(label) },
          imageMessagePart(cropBuffer, mimeType),
        ],
      },
    ],
    true,
  );

  const parsed = parseJson<WrongQuestionAnalysis>(content);
  const finalSubjectKey = normalizeSubjectKey(parsed.subject || label);

  return {
    subject: subjectKeyToLabel(finalSubjectKey),
    question: parsed.question || '',
    student_answer: parsed.student_answer || '',
    correct_answer: parsed.correct_answer || '',
    error_analysis: parsed.error_analysis || '',
    knowledge_points: Array.isArray(parsed.knowledge_points) ? parsed.knowledge_points : [],
  };
}

async function analyzeWrongQuestionImage(
  imageBuffer: Buffer,
  mimeType: string,
  options?: { includeMeta?: boolean },
): Promise<WrongQuestionAnalysis> {
  const detection = await detectSubjectFromImage(imageBuffer, mimeType);

  const visionResolved = resolveModelRef('vision_analyze', detection.subjectKey);
  if (!visionResolved) {
    throw new Error(`未配置 ${detection.subjectLabel} 学科的题目理解模型（vision_analyze）`);
  }

  const content = await chatCompletion(
    visionResolved,
    [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${ANALYZE_PROMPT(detection.subjectLabel)}\n\n预判学科：${detection.subjectLabel}（仅供参考，以图片为准）`,
          },
          imageMessagePart(imageBuffer, mimeType),
        ],
      },
    ],
    true,
  );

  const parsed = parseJson<WrongQuestionAnalysis>(content);
  const finalSubjectKey = normalizeSubjectKey(parsed.subject || detection.subjectLabel);

  const result: WrongQuestionAnalysis = {
    subject: subjectKeyToLabel(finalSubjectKey),
    question: parsed.question || '',
    student_answer: parsed.student_answer || '',
    correct_answer: parsed.correct_answer || '',
    error_analysis: parsed.error_analysis || '',
    knowledge_points: Array.isArray(parsed.knowledge_points) ? parsed.knowledge_points : [],
  };

  if (options?.includeMeta || process.env.NODE_ENV === 'development') {
    const modelsUsed: Partial<Record<AiCapability, string>> = {
      subject_detect: detection.model,
      vision_analyze: `${visionResolved.provider}:${visionResolved.model}`,
    };
    result._meta = {
      detected_subject: subjectKeyToLabel(detection.subjectKey),
      subject_key: finalSubjectKey,
      models: modelsUsed,
    };
  }

  return result;
}

async function generateSimilarQuestions(
  record: {
    subject: string;
    question_text: string | null;
    student_answer: string | null;
    correct_answer: string | null;
    error_analysis: string | null;
    knowledge_points: string | null;
  },
  count = 3,
): Promise<GeneratedPracticeQuestion[]> {
  const subjectKey = normalizeSubjectKey(record.subject);
  const resolved = resolveModelRef('generate_similar', subjectKey);
  if (!resolved) {
    throw new Error(`未配置 ${record.subject} 学科的相似题生成模型（generate_similar）`);
  }

  let knowledgePoints: string[] = [];
  if (record.knowledge_points) {
    try {
      knowledgePoints = JSON.parse(record.knowledge_points) as string[];
    } catch {
      knowledgePoints = [];
    }
  }

  const prompt = `根据以下错题，生成 ${count} 道难度相近、考查相同知识点的练习题，适合中国学生巩固复习。
科目：${record.subject}
原题：${record.question_text || '（见错题记录）'}
正确答案：${record.correct_answer || ''}
错因：${record.error_analysis || ''}
知识点：${knowledgePoints.join('、') || '无'}

请严格返回 JSON：
{
  "questions": [
    {
      "question": "题目内容",
      "question_type": "choice 或 fill",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."] 或 null（填空题用 null）,
      "answer": "正确答案",
      "explanation": "简要解析"
    }
  ]
}
要求：题目不要和原题完全相同，但要考查相同知识点；至少 1 道选择题、1 道填空题；符合国内教材表述习惯。`;

  const content = await chatCompletion(resolved, [{ role: 'user', content: prompt }], true);

  const parsed = parseJson<{ questions: GeneratedPracticeQuestion[] }>(content);
  return (parsed.questions ?? []).slice(0, count).map((q) => ({
    question: q.question || '',
    question_type: q.question_type === 'choice' ? 'choice' : 'fill',
    options: q.options ?? null,
    answer: q.answer || '',
    explanation: q.explanation || '',
  }));
}

export { detectSubjectFromImage, analyzeWrongQuestionImage, analyzeWrongQuestionCrop, generateSimilarQuestions };

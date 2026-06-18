interface AiConfig {
  baseUrl: string;
  apiKey: string;
  visionModel: string;
  textModel: string;
}

interface WrongQuestionAnalysis {
  subject: string;
  question: string;
  student_answer: string;
  correct_answer: string;
  error_analysis: string;
  knowledge_points: string[];
}

interface GeneratedPracticeQuestion {
  question: string;
  question_type: 'choice' | 'fill';
  options: string[] | null;
  answer: string;
  explanation: string;
}

function getAiConfig(): AiConfig | null {
  const baseUrl = process.env.AI_API_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.AI_API_KEY;
  if (!baseUrl || !apiKey) return null;

  return {
    baseUrl,
    apiKey,
    visionModel: process.env.AI_VISION_MODEL || 'gpt-4o',
    textModel: process.env.AI_TEXT_MODEL || 'gpt-4o-mini',
  };
}

function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}

async function chatCompletion(
  config: AiConfig,
  model: string,
  messages: { role: string; content: unknown }[],
  jsonMode = false,
): Promise<string> {
  const body: Record<string, unknown> = { model, messages, temperature: 0.3 };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI 请求失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI 返回内容为空');
  }
  return content;
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

const ANALYZE_PROMPT = `你是一位耐心的小学/初中辅导老师。请分析图片中的错题，用中文回答。
请严格返回 JSON 格式（不要 markdown 代码块）：
{
  "subject": "科目（数学/语文/英语/科学/其他）",
  "question": "题目完整内容（尽量还原题干）",
  "student_answer": "学生写的答案（看不清则写「未识别」）",
  "correct_answer": "正确答案及简要解题步骤",
  "error_analysis": "错因分析，指出学生哪里做错了，用孩子能懂的语言",
  "knowledge_points": ["知识点1", "知识点2"]
}`;

async function analyzeWrongQuestionImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<WrongQuestionAnalysis> {
  const config = getAiConfig();
  if (!config) {
    throw new Error('未配置 AI 接口，请在环境变量中设置 AI_API_BASE_URL 和 AI_API_KEY');
  }

  const base64 = imageBuffer.toString('base64');
  const content = await chatCompletion(
    config,
    config.visionModel,
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: ANALYZE_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    true,
  );

  const parsed = parseJson<WrongQuestionAnalysis>(content);
  return {
    subject: parsed.subject || '其他',
    question: parsed.question || '',
    student_answer: parsed.student_answer || '',
    correct_answer: parsed.correct_answer || '',
    error_analysis: parsed.error_analysis || '',
    knowledge_points: Array.isArray(parsed.knowledge_points) ? parsed.knowledge_points : [],
  };
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
  const config = getAiConfig();
  if (!config) {
    throw new Error('未配置 AI 接口');
  }

  let knowledgePoints: string[] = [];
  if (record.knowledge_points) {
    try {
      knowledgePoints = JSON.parse(record.knowledge_points) as string[];
    } catch {
      knowledgePoints = [];
    }
  }

  const prompt = `根据以下错题，生成 ${count} 道难度相近、考查相同知识点的练习题，适合学生巩固复习。
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
要求：题目不要和原题完全相同，但要考查相同知识点；至少 1 道选择题、1 道填空题。`;

  const content = await chatCompletion(
    config,
    config.textModel,
    [{ role: 'user', content: prompt }],
    true,
  );

  const parsed = parseJson<{ questions: GeneratedPracticeQuestion[] }>(content);
  return (parsed.questions ?? []).slice(0, count).map((q) => ({
    question: q.question || '',
    question_type: q.question_type === 'choice' ? 'choice' : 'fill',
    options: q.options ?? null,
    answer: q.answer || '',
    explanation: q.explanation || '',
  }));
}

export {
  isAiConfigured,
  analyzeWrongQuestionImage,
  generateSimilarQuestions,
};
export type { WrongQuestionAnalysis, GeneratedPracticeQuestion };

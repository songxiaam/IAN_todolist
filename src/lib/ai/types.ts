/** AI 能力类型 */
type AiCapability =
  | 'subject_detect'
  | 'vision_analyze'
  | 'generate_similar'
  | 'handwriting_remove';

/** 学科路由键（与 config/ai-models.json 中的 key 一致） */
type AiSubjectKey =
  | 'math'
  | 'chinese'
  | 'english'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'science'
  | 'history'
  | 'geography'
  | 'politics'
  | 'other';

/** 展示用中文科目名 */
type AiSubjectLabel =
  | '数学'
  | '语文'
  | '英语'
  | '物理'
  | '化学'
  | '生物'
  | '科学'
  | '历史'
  | '地理'
  | '政治'
  | '其他';

interface AiProviderConfig {
  baseUrl: string;
  apiKeyEnv: string;
}

interface CapabilityEntry {
  provider?: string;
  default: string;
  [subject: string]: string | undefined;
}

interface AiModelRoutingFile {
  _comment?: string;
  providers: Record<string, AiProviderConfig>;
  defaultProvider?: string;
  capabilities: Record<AiCapability, CapabilityEntry>;
}

interface ResolvedModel {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
}

interface WrongQuestionAnalysis {
  subject: string;
  question: string;
  student_answer: string;
  correct_answer: string;
  error_analysis: string;
  knowledge_points: string[];
  /** 开发调试：本次请求使用的模型路由信息 */
  _meta?: {
    detected_subject: AiSubjectLabel;
    subject_key: AiSubjectKey;
    models: Partial<Record<AiCapability, string>>;
  };
}

interface GeneratedPracticeQuestion {
  question: string;
  question_type: 'choice' | 'fill';
  options: string[] | null;
  answer: string;
  explanation: string;
}

interface AiRoutingSnapshot {
  configured: boolean;
  configPath: string;
  activeProvider: string;
  capabilities: Record<
    AiCapability,
    { default: string; subjects: Record<string, string> }
  >;
  envOverrides: string[];
}

export type {
  AiCapability,
  AiSubjectKey,
  AiSubjectLabel,
  AiProviderConfig,
  AiModelRoutingFile,
  ResolvedModel,
  WrongQuestionAnalysis,
  GeneratedPracticeQuestion,
  AiRoutingSnapshot,
};

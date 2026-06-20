/** @deprecated 请使用 @/lib/ai/index，此文件保留兼容旧 import 路径 */
export {
  analyzeWrongQuestionImage,
  analyzeWrongQuestionCrop,
  detectSubjectFromImage,
  generateSimilarQuestions,
  gradeHomeworkImage,
  getAiRoutingSnapshot,
  getConfigPath,
  isAiConfigured,
  listResolvedModels,
  reloadAiModelConfig,
  resolveModelRef,
  ALL_SUBJECT_LABELS,
  normalizeSubjectKey,
  subjectKeyToLabel,
} from './ai/index';
export type {
  AiCapability,
  AiRoutingSnapshot,
  AiSubjectKey,
  AiSubjectLabel,
  GeneratedPracticeQuestion,
  WrongQuestionAnalysis,
} from './ai/index';

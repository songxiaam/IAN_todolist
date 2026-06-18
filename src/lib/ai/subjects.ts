import type { AiSubjectKey, AiSubjectLabel } from './types';

const SUBJECT_LABEL_TO_KEY: Record<string, AiSubjectKey> = {
  数学: 'math',
  语文: 'chinese',
  英语: 'english',
  物理: 'physics',
  化学: 'chemistry',
  生物: 'biology',
  科学: 'science',
  历史: 'history',
  地理: 'geography',
  政治: 'politics',
  其他: 'other',
};

const SUBJECT_KEY_TO_LABEL: Record<AiSubjectKey, AiSubjectLabel> = {
  math: '数学',
  chinese: '语文',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  science: '科学',
  history: '历史',
  geography: '地理',
  politics: '政治',
  other: '其他',
};

const ALL_SUBJECT_LABELS = Object.keys(SUBJECT_LABEL_TO_KEY) as AiSubjectLabel[];

function normalizeSubjectKey(raw: string): AiSubjectKey {
  const trimmed = raw.trim();
  if (trimmed in SUBJECT_LABEL_TO_KEY) {
    return SUBJECT_LABEL_TO_KEY[trimmed];
  }

  const lower = trimmed.toLowerCase();
  const englishMap: Record<string, AiSubjectKey> = {
    math: 'math',
    mathematics: 'math',
    chinese: 'chinese',
    english: 'english',
    physics: 'physics',
    chemistry: 'chemistry',
    biology: 'biology',
    science: 'science',
    history: 'history',
    geography: 'geography',
    politics: 'politics',
    other: 'other',
  };
  if (lower in englishMap) {
    return englishMap[lower];
  }

  if (trimmed.includes('数')) return 'math';
  if (trimmed.includes('语') && !trimmed.includes('英')) return 'chinese';
  if (trimmed.includes('英')) return 'english';
  if (trimmed.includes('物')) return 'physics';
  if (trimmed.includes('化')) return 'chemistry';
  if (trimmed.includes('生')) return 'biology';
  if (trimmed.includes('史')) return 'history';
  if (trimmed.includes('地')) return 'geography';
  if (trimmed.includes('政')) return 'politics';

  return 'other';
}

function subjectKeyToLabel(key: AiSubjectKey): AiSubjectLabel {
  return SUBJECT_KEY_TO_LABEL[key];
}

export {
  SUBJECT_LABEL_TO_KEY,
  SUBJECT_KEY_TO_LABEL,
  ALL_SUBJECT_LABELS,
  normalizeSubjectKey,
  subjectKeyToLabel,
};

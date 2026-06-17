const STORAGE_KEY = 'homework_focus_timer';

interface StoredFocusTimer {
  userId: string;
  homeworkId: number;
  title: string;
  subject: string;
  estimatedMinutes: number;
  endsAt: number | null;
  remainingSeconds: number;
  running: boolean;
  pausedSecondsUsed: number;
  pauseStartedAt: number | null;
}

function saveFocusTimer(state: StoredFocusTimer): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadFocusTimer(): StoredFocusTimer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFocusTimer;
    return {
      ...parsed,
      pausedSecondsUsed: parsed.pausedSecondsUsed ?? 0,
      pauseStartedAt: parsed.pauseStartedAt ?? null,
    };
  } catch {
    return null;
  }
}

function clearFocusTimer(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

function calcRemainingFromStartedAt(
  startedAt: string,
  estimatedMinutes: number,
): number {
  const end = new Date(startedAt).getTime() + estimatedMinutes * 60 * 1000;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

function resolveRemainingSeconds(stored: StoredFocusTimer): number {
  if (stored.running && stored.endsAt) {
    return Math.max(0, Math.ceil((stored.endsAt - Date.now()) / 1000));
  }
  return stored.remainingSeconds;
}

export type { StoredFocusTimer };
export {
  STORAGE_KEY,
  saveFocusTimer,
  loadFocusTimer,
  clearFocusTimer,
  calcRemainingFromStartedAt,
  resolveRemainingSeconds,
};

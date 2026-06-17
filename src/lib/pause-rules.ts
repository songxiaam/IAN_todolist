export const MAX_CUMULATIVE_PAUSE_SECONDS = 5 * 60;

interface MultiplicationQuiz {
  a: number;
  b: number;
  answer: number;
}

function generateMultiplicationQuiz(): MultiplicationQuiz {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  return { a, b, answer: a * b };
}

function getCurrentPauseElapsed(pauseStartedAt: number | null): number {
  if (!pauseStartedAt) return 0;
  return Math.floor((Date.now() - pauseStartedAt) / 1000);
}

function getTotalPausedSeconds(
  pausedSecondsUsed: number,
  pauseStartedAt: number | null,
): number {
  return pausedSecondsUsed + getCurrentPauseElapsed(pauseStartedAt);
}

function getRemainingPauseBudget(
  pausedSecondsUsed: number,
  pauseStartedAt: number | null,
): number {
  return Math.max(
    0,
    MAX_CUMULATIVE_PAUSE_SECONDS - getTotalPausedSeconds(pausedSecondsUsed, pauseStartedAt),
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export type { MultiplicationQuiz };
export {
  generateMultiplicationQuiz,
  getCurrentPauseElapsed,
  getTotalPausedSeconds,
  getRemainingPauseBudget,
  formatDuration,
};

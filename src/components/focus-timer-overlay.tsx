'use client';

import { useEffect, useState } from 'react';
import { Pause, Play, CheckCircle2 } from 'lucide-react';
import {
  generateMultiplicationQuiz,
  getTotalPausedSeconds,
  getRemainingPauseBudget,
  formatDuration,
  MAX_CUMULATIVE_PAUSE_SECONDS,
  type MultiplicationQuiz,
} from '@/lib/pause-rules';

interface FocusTimerOverlayProps {
  title: string;
  subject: string;
  timerSeconds: number;
  timerRunning: boolean;
  pausedSecondsUsed: number;
  pauseStartedAt: number | null;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function FocusTimerOverlay({
  title,
  subject,
  timerSeconds,
  timerRunning,
  pausedSecondsUsed,
  pauseStartedAt,
  onPause,
  onResume,
  onComplete,
}: FocusTimerOverlayProps) {
  const [tick, setTick] = useState(0);
  const [showPauseQuiz, setShowPauseQuiz] = useState(false);
  const [quiz, setQuiz] = useState<MultiplicationQuiz | null>(null);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizError, setQuizError] = useState('');

  const isTimeUp = timerSeconds <= 0;
  const isPaused = !timerRunning && !isTimeUp;
  const totalPaused = getTotalPausedSeconds(pausedSecondsUsed, pauseStartedAt);
  const remainingPauseBudget = getRemainingPauseBudget(pausedSecondsUsed, pauseStartedAt);
  const pauseBudgetExhausted = pausedSecondsUsed >= MAX_CUMULATIVE_PAUSE_SECONDS;

  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  void tick;

  const openPauseQuiz = () => {
    if (pauseBudgetExhausted) return;
    setQuiz(generateMultiplicationQuiz());
    setQuizAnswer('');
    setQuizError('');
    setShowPauseQuiz(true);
  };

  const submitPauseQuiz = () => {
    if (!quiz) return;
    const answer = parseInt(quizAnswer.trim(), 10);
    if (Number.isNaN(answer) || answer !== quiz.answer) {
      setQuizError('答错了，再试一次！');
      setQuiz(generateMultiplicationQuiz());
      setQuizAnswer('');
      return;
    }
    setShowPauseQuiz(false);
    onPause();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FFFBF5] paper-bg px-6"
      role="dialog"
      aria-modal="true"
      aria-label="专注学习倒计时"
    >
      <div className="w-full max-w-lg text-center sketchy-enter">
        <p className="text-sm text-[#8D6E63] mb-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          📚 专注学习时间
        </p>

        <span className="inline-block text-xs text-[#8D6E63] bg-[#F5E6D3] px-3 py-1 rounded-lg mb-4">
          {subject}
        </span>

        <h2
          className="text-2xl text-[#5D4037] mb-8 px-2"
          style={{ fontFamily: "'Patrick Hand', cursive" }}
        >
          {title}
        </h2>

        <div
          className={`timer-sketchy text-6xl sm:text-7xl mb-4 ${
            isTimeUp ? 'text-[#7CB342]' : timerSeconds <= 60 ? 'text-[#EF5350]' : 'text-[#FFB74D]'
          }`}
        >
          {formatTime(timerSeconds)}
        </div>

        <p className="text-[#5D4037] mb-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          {isTimeUp
            ? '🎉 时间到啦！记得点击完成哦'
            : timerRunning
              ? '⏰ 加油，保持专注！'
              : '⏸️ 休息中...'}
        </p>

        {isPaused && (
          <div className="sketchy-card p-4 mb-6 bg-[#FFB74D]/20 text-left max-w-sm mx-auto">
            <p className="text-sm text-[#5D4037]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              本任务累计休息 {formatDuration(totalPaused)} / {formatDuration(MAX_CUMULATIVE_PAUSE_SECONDS)}
            </p>
            {remainingPauseBudget > 0 ? (
              <p className="text-xs text-[#8D6E63] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {formatDuration(remainingPauseBudget)} 后将自动继续倒计时
              </p>
            ) : (
              <p className="text-xs text-[#EF5350] mt-2" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                休息时间已满，即将自动继续...
              </p>
            )}
          </div>
        )}

        {!isPaused && !isTimeUp && (
          <p className="text-xs text-[#8D6E63] mb-6" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            本任务累计还可休息 {formatDuration(MAX_CUMULATIVE_PAUSE_SECONDS - pausedSecondsUsed)}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-sm mx-auto">
          {!isTimeUp && timerRunning && (
            <button
              className="flex-1 py-4 px-6 crayon-button-orange text-[#5D4037] flex items-center justify-center gap-2 text-lg disabled:opacity-50"
              onClick={openPauseQuiz}
              disabled={pauseBudgetExhausted}
            >
              <Pause className="w-5 h-5" />
              {pauseBudgetExhausted ? '休息已满' : '暂停'}
            </button>
          )}
          {!isTimeUp && isPaused && (
            <button
              className="flex-1 py-4 px-6 crayon-button-orange text-[#5D4037] flex items-center justify-center gap-2 text-lg"
              onClick={onResume}
            >
              <Play className="w-5 h-5" />
              继续学习
            </button>
          )}
          <button
            className="flex-1 py-4 px-6 crayon-button text-[#FFFDE7] flex items-center justify-center gap-2 text-lg"
            onClick={onComplete}
          >
            <CheckCircle2 className="w-5 h-5" />
            {isTimeUp ? '完成作业' : '完成'}
          </button>
        </div>

        <p className="text-xs text-[#8D6E63] mt-10" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          专注模式已开启，每个任务累计最多休息 5 分钟
        </p>
      </div>

      {showPauseQuiz && quiz && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#5D4037]/40 px-4">
          <div className="w-full max-w-md sketchy-card p-6 bg-[#FFFDE7] sketchy-enter">
            <h3
              className="text-xl text-[#5D4037] text-center mb-3"
              style={{ fontFamily: "'Patrick Hand', cursive" }}
            >
              ⏸️ 申请休息
            </h3>
            <p className="text-sm text-[#8D6E63] text-center mb-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              每个任务累计最多只能休息 5 分钟，休息满后将自动继续倒计时。
              <br />
              答对下面的乘法口诀题才能暂停。
            </p>
            <p className="text-sm text-[#5D4037] text-center mb-4" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              本任务还可休息 {formatDuration(MAX_CUMULATIVE_PAUSE_SECONDS - pausedSecondsUsed)}
            </p>

            <div className="text-center mb-4">
              <p className="text-3xl text-[#FFB74D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
                {quiz.a} × {quiz.b} = ?
              </p>
            </div>

            <input
              type="number"
              inputMode="numeric"
              placeholder="输入答案..."
              value={quizAnswer}
              onChange={(e) => setQuizAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPauseQuiz()}
              className="w-full py-3 px-4 pencil-input text-lg text-center mb-2"
              autoFocus
            />

            {quizError && (
              <p className="text-sm text-[#EF5350] text-center mb-3">{quizError}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 py-3 bg-transparent text-[#8D6E63] border-2 border-[#D7CCC8] rounded-lg hover:bg-[#F5E6D3] transition-all"
                onClick={() => setShowPauseQuiz(false)}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 crayon-button text-[#FFFDE7]"
                onClick={submitPauseQuiz}
              >
                确认暂停
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

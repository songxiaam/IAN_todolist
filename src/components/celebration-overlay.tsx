'use client';

import { useEffect, useState } from 'react';

interface CelebrationOverlayProps {
  pointsEarned: number;
  onClose: () => void;
}

const EMOJIS = ['🎉', '⭐', '🏆', '🔥', '💪', '🚀', '✨', '🎊', '👏', '💯', '🌟', '🎯', '⚡', '🥳'];

export function CelebrationOverlay({ pointsEarned, onClose }: CelebrationOverlayProps) {
  const [phase, setPhase] = useState(0);
  const [particles, setParticles] = useState<
    { id: number; emoji: string; left: number; delay: number; duration: number; size: number }[]
  >([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        emoji: EMOJIS[i % EMOJIS.length],
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 1.5 + Math.random() * 2,
        size: 16 + Math.random() * 36,
      })),
    );

    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(onClose, 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden cursor-pointer animate-celebration-shake"
      style={{
        background: phase >= 1
          ? 'radial-gradient(circle, #FFF9C4 0%, #FFB74D 40%, #FF7043 80%, #E64A19 100%)'
          : '#FF7043',
        transition: 'background 0.5s ease',
      }}
      onClick={onClose}
      role="presentation"
    >
      {/* 闪光脉冲 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.4) 0%, transparent 60%)',
          animation: 'celebration-flash 0.6s ease-out',
        }}
      />

      {/* 彩带粒子 */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute animate-celebration-fall pointer-events-none"
          style={{
            left: `${p.left}%`,
            top: '-10%',
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}

      {/* 中心爆发环 */}
      {phase >= 2 && (
        <>
          <div className="absolute w-64 h-64 rounded-full border-4 border-[#FFFDE7]/60 animate-celebration-ring" />
          <div className="absolute w-96 h-96 rounded-full border-2 border-[#FFFDE7]/30 animate-celebration-ring" style={{ animationDelay: '0.15s' }} />
        </>
      )}

      <div
        className="relative z-10 text-center px-6"
        style={{
          transform: phase >= 1 ? 'scale(1)' : 'scale(0.2)',
          opacity: phase >= 1 ? 1 : 0,
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s',
        }}
      >
        <p className="text-8xl mb-4 animate-celebration-bounce">🎉</p>
        <h2
          className="text-5xl sm:text-7xl text-[#5D4037] font-bold mb-3"
          style={{
            fontFamily: "'Patrick Hand', cursive",
            textShadow: '3px 3px 0 #FFFDE7, 5px 5px 0 rgba(93,64,55,0.3)',
            animation: 'celebration-wiggle 0.5s ease-in-out infinite alternate',
          }}
        >
          太棒了！！！
        </h2>
        <p
          className="text-2xl sm:text-3xl text-[#FFFDE7] mb-6"
          style={{ fontFamily: "'Patrick Hand', cursive", textShadow: '2px 2px 0 #5D4037' }}
        >
          作业完成！你真厉害！
        </p>
        {pointsEarned > 0 && (
          <div
            className="inline-block sketchy-card px-8 py-4 bg-[#7CB342] text-[#FFFDE7] text-3xl sm:text-4xl transform rotate-2 animate-celebration-bounce"
            style={{ boxShadow: '4px 4px 0 #5D4037' }}
          >
            +{pointsEarned} 积分 🌟
          </div>
        )}
        <p className="text-sm text-[#5D4037] mt-8 opacity-80 animate-pulse">点击任意处关闭</p>
      </div>
    </div>
  );
}

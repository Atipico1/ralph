'use client';

interface ProgressBarProps {
  questionCount: number;
  maxQuestions: number;
}

export default function ProgressBar({
  questionCount,
  maxQuestions,
}: ProgressBarProps) {
  const progress = maxQuestions > 0 ? (questionCount / maxQuestions) * 100 : 0;
  const clampedProgress = Math.min(progress, 100);

  return (
    <div className="w-full">
      {/* Track only — no step counter */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
        <div
          className="relative h-full rounded-full bg-zinc-900 transition-all duration-700 ease-out"
          style={{ width: `${clampedProgress}%` }}
        >
          {clampedProgress > 0 && clampedProgress < 100 && (
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent bg-[length:200%_100%]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
      <p className="mb-2 text-sm font-medium text-gray-500">
        상담 {questionCount}/{maxQuestions}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

'use client';

interface NavigationButtonsProps {
  onPrevious: () => void;
  onSkip: () => void;
  canGoBack: boolean;
  isLoading: boolean;
  isFirstQuestion: boolean;
}

export default function NavigationButtons({
  onPrevious,
  onSkip,
  canGoBack,
  isLoading,
  isFirstQuestion,
}: NavigationButtonsProps) {
  const isPreviousDisabled = !canGoBack || isFirstQuestion;

  return (
    <div className="flex items-center justify-between pt-4">
      <button
        type="button"
        onClick={onPrevious}
        disabled={isPreviousDisabled}
        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
      >
        ← 이전
      </button>

      <button
        type="button"
        onClick={onSkip}
        disabled={isLoading}
        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
      >
        건너뛰기 →
      </button>
    </div>
  );
}

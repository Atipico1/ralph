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
    <div className="flex items-center justify-between border-t border-border-subtle pt-5">
      <button
        type="button"
        onClick={onPrevious}
        disabled={isPreviousDisabled}
        className="group flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-surface-tertiary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
      >
        <svg
          className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        이전
      </button>

      <button
        type="button"
        onClick={onSkip}
        disabled={isLoading}
        className="group flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-surface-tertiary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
      >
        건너뛰기
        <svg
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}

'use client';

interface YesNoInputProps {
  onSubmit: (message: string) => void;
  disabled: boolean;
}

export default function YesNoInput({ onSubmit, disabled }: YesNoInputProps) {
  function handleClick(answer: string) {
    if (disabled) return;
    onSubmit(answer);
  }

  return (
    <div className="flex w-full gap-4">
      {/* Yes card */}
      <button
        type="button"
        onClick={() => handleClick('네')}
        disabled={disabled}
        className="group flex flex-1 flex-col items-center gap-3 rounded-2xl border border-border-default bg-surface-primary px-6 py-7 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md hover:shadow-zinc-900/5 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-default disabled:hover:bg-surface-primary disabled:hover:shadow-sm disabled:active:scale-100"
      >
        {/* Icon circle */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 transition-colors duration-200 group-hover:bg-zinc-200">
          <svg
            className="h-6 w-6 text-zinc-600 transition-colors duration-200 group-hover:text-zinc-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <span className="text-lg font-semibold text-text-primary">네</span>
      </button>

      {/* No card */}
      <button
        type="button"
        onClick={() => handleClick('아니요')}
        disabled={disabled}
        className="group flex flex-1 flex-col items-center gap-3 rounded-2xl border border-border-default bg-surface-primary px-6 py-7 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow-md hover:shadow-gray-500/5 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-default disabled:hover:bg-surface-primary disabled:hover:shadow-sm disabled:active:scale-100"
      >
        {/* Icon circle */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-colors duration-200 group-hover:bg-gray-200">
          <svg
            className="h-6 w-6 text-gray-400 transition-colors duration-200 group-hover:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <span className="text-lg font-semibold text-text-primary">아니요</span>
      </button>
    </div>
  );
}

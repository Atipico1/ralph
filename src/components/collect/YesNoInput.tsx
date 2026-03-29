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
      <button
        type="button"
        onClick={() => handleClick('네')}
        disabled={disabled}
        className="flex-1 rounded-xl border border-gray-200 bg-white px-6 py-5 text-lg font-medium text-gray-900 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        네
      </button>
      <button
        type="button"
        onClick={() => handleClick('아니요')}
        disabled={disabled}
        className="flex-1 rounded-xl border border-gray-200 bg-white px-6 py-5 text-lg font-medium text-gray-900 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        아니요
      </button>
    </div>
  );
}

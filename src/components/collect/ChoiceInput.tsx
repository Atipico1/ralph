'use client';

import { useState, type FormEvent } from 'react';

interface ChoiceInputProps {
  options: string[];
  onSubmit: (message: string, optionIndex?: number) => void;
  disabled: boolean;
}

export default function ChoiceInput({
  options,
  onSubmit,
  disabled,
}: ChoiceInputProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');

  const lastIndex = options.length - 1;

  function handleOptionClick(index: number) {
    if (disabled) return;

    // "기타 (직접 입력)" — show text input instead of submitting
    if (index === lastIndex) {
      setShowCustomInput(true);
      return;
    }

    // Regular option — submit immediately
    onSubmit(options[index], index);
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    const trimmed = customText.trim();
    if (!trimmed) return;
    onSubmit(trimmed, lastIndex);
    setCustomText('');
    setShowCustomInput(false);
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {options.map((option, index) => (
        <button
          key={option}
          type="button"
          onClick={() => handleOptionClick(index)}
          disabled={disabled}
          className="group flex w-full items-center gap-3.5 rounded-2xl border border-border-default bg-surface-primary px-5 py-4.5 text-left text-base shadow-sm transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md hover:shadow-zinc-900/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="font-medium text-text-primary">{option}</span>
        </button>
      ))}

      {showCustomInput && (
        <form onSubmit={handleCustomSubmit} className="mt-1 flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="직접 입력해주세요..."
            disabled={disabled}
            autoFocus
            className="flex-1 rounded-2xl border border-border-default bg-surface-primary px-5 py-3.5 text-base text-text-primary placeholder-text-tertiary shadow-sm transition-all duration-200 focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !customText.trim()}
            className="shrink-0 rounded-2xl bg-zinc-900 px-6 py-3.5 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            확인
          </button>
        </form>
      )}
    </div>
  );
}

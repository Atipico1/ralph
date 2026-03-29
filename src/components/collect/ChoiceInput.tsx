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

    // Last option is always "기타" — show custom input
    if (index === lastIndex) {
      setShowCustomInput(true);
      return;
    }

    onSubmit(options[index], index);
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed || disabled) return;
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
          className="w-full rounded-xl border border-gray-200 bg-white px-6 py-4 text-left text-base text-gray-900 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option}
        </button>
      ))}

      {showCustomInput && (
        <form onSubmit={handleCustomSubmit} className="mt-2 flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="직접 입력해주세요..."
            disabled={disabled}
            autoFocus
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !customText.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            확인
          </button>
        </form>
      )}
    </div>
  );
}

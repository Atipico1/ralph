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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [customText, setCustomText] = useState('');

  const lastIndex = options.length - 1;
  const isCustomSelected = selectedIndex === lastIndex;

  function handleOptionClick(index: number) {
    if (disabled) return;
    setSelectedIndex(index);
    if (index !== lastIndex) {
      setCustomText('');
    }
  }

  function handleConfirm() {
    if (disabled || selectedIndex === null) return;

    if (isCustomSelected) {
      const trimmed = customText.trim();
      if (!trimmed) return;
      onSubmit(trimmed, lastIndex);
    } else {
      onSubmit(options[selectedIndex], selectedIndex);
    }

    // Reset state after submit
    setSelectedIndex(null);
    setCustomText('');
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    handleConfirm();
  }

  const isConfirmDisabled =
    disabled ||
    selectedIndex === null ||
    (isCustomSelected && !customText.trim());

  return (
    <div className="flex w-full flex-col gap-3">
      {options.map((option, index) => {
        const isSelected = selectedIndex === index;

        return (
          <button
            key={option}
            type="button"
            onClick={() => handleOptionClick(index)}
            disabled={disabled}
            className={`w-full rounded-xl border px-6 py-4 text-left text-base shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected
                ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500/30'
                : 'border-gray-200 bg-white text-gray-900 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            {option}
          </button>
        );
      })}

      {isCustomSelected && (
        <form onSubmit={handleCustomSubmit} className="mt-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="직접 입력해주세요..."
            disabled={disabled}
            autoFocus
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
          />
        </form>
      )}

      {selectedIndex !== null && (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirmDisabled}
          className="mt-1 w-full rounded-xl bg-blue-600 px-6 py-3.5 text-base font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {disabled ? '처리 중...' : '확인'}
        </button>
      )}
    </div>
  );
}

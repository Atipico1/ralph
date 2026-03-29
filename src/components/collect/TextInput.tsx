'use client';

import { useState, type FormEvent } from 'react';

interface TextInputProps {
  onSubmit: (message: string) => void;
  disabled: boolean;
}

export default function TextInput({ onSubmit, disabled }: TextInputProps) {
  const [text, setText] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="답변을 입력해주세요..."
        rows={4}
        disabled={disabled}
        autoFocus
        className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="self-end rounded-xl bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        다음
      </button>
    </form>
  );
}

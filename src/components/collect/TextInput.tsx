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
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div className="group relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="답변을 입력해주세요..."
          rows={4}
          disabled={disabled}
          autoFocus
          className="w-full resize-none rounded-2xl border border-border-default bg-surface-primary px-5 py-4 text-base leading-relaxed text-text-primary placeholder-text-tertiary shadow-sm transition-all duration-200 focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        {/* Subtle gradient border glow on focus */}
        <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-200 group-focus-within:opacity-100">
          <div className="h-full w-full rounded-2xl ring-1 ring-zinc-300/40" />
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="group/btn relative self-end overflow-hidden rounded-2xl bg-zinc-900 px-8 py-3.5 text-base font-medium text-text-inverse shadow-md shadow-zinc-900/15 transition-all duration-200 hover:bg-zinc-800 hover:shadow-lg hover:shadow-zinc-900/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100 disabled:active:scale-100"
      >
        <span className="relative z-10">다음</span>
        {/* Hover shimmer effect */}
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover/btn:translate-x-full" />
      </button>
    </form>
  );
}

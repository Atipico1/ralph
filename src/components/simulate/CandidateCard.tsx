'use client';

import type { CandidateStatus } from '@/hooks/useSimulate';

// ── Constants ───────────────────────────────────────────────────────────────

const INDEX_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

const STATUS_TEXT: Record<CandidateStatus, string> = {
  idle: '대기 중',
  streaming: '생성 중...',
  done: '완료',
  error: '오류',
};

const STATUS_DOT_CLASSES: Record<CandidateStatus, string> = {
  idle: 'bg-text-tertiary',
  streaming: 'bg-zinc-700 animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-red-500',
};

// ── Props ───────────────────────────────────────────────────────────────────

interface CandidateCardProps {
  index: number;
  label: string;
  content: string;
  status: CandidateStatus;
  isSelected: boolean;
  error?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CandidateCard({
  index,
  label,
  content,
  status,
  isSelected,
  error,
}: CandidateCardProps) {
  const letter = INDEX_LABELS[index] ?? String(index);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
        isSelected
          ? 'border-zinc-900 bg-zinc-50/40 shadow-lg ring-1 ring-zinc-200'
          : status === 'streaming'
            ? 'border-border-default bg-surface-primary shadow-sm'
            : status === 'error'
              ? 'border-red-200 bg-red-50/30 shadow-sm'
              : 'border-border-subtle bg-surface-primary shadow-sm hover:shadow-md'
      }`}
    >
      {/* Selected glow effect */}
      {isSelected && (
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-zinc-200/20 to-transparent" />
      )}

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-colors duration-300 ${
              isSelected
                ? 'bg-zinc-900 text-white shadow-sm'
                : status === 'done'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-surface-tertiary text-text-secondary'
            }`}
          >
            {letter}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {label}
            </h3>
          </div>
        </div>
        {/* Status dot */}
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
          <span
            className={`text-xs font-medium ${
              status === 'error'
                ? 'text-red-500'
                : status === 'done'
                  ? 'text-emerald-600'
                  : 'text-text-tertiary'
            }`}
          >
            {STATUS_TEXT[status]}
          </span>
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────────────────── */}
      <div className="mb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
          {status === 'streaming' ? (
            <div className="h-full w-full animate-simulate-progress rounded-full bg-zinc-400" />
          ) : status === 'done' ? (
            <div className="h-full w-full rounded-full bg-emerald-400 transition-all duration-500" />
          ) : status === 'error' ? (
            <div className="h-full w-full rounded-full bg-red-400" />
          ) : (
            <div className="h-full w-0 rounded-full bg-surface-tertiary" />
          )}
        </div>
      </div>

      {/* ── Error message ─────────────────────────────────────── */}
      {status === 'error' && error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <svg
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p className="text-xs leading-relaxed text-red-600">{error}</p>
        </div>
      )}

      {/* ── Content preview ───────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {content ? (
          <div className="relative">
            <p className={`whitespace-pre-wrap text-sm leading-relaxed text-text-secondary ${
              status === 'streaming' ? 'max-h-32 overflow-hidden' : 'line-clamp-6'
            }`}>
              {content}
            </p>
            {/* Streaming cursor effect */}
            {status === 'streaming' && (
              <>
                <span className="inline-block h-4 w-0.5 animate-pulse bg-zinc-900 align-text-bottom" />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
              </>
            )}
          </div>
        ) : status === 'idle' ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary opacity-40" />
            <p className="text-sm text-text-tertiary">생성 대기 중...</p>
          </div>
        ) : status === 'streaming' ? (
          <div className="flex items-center gap-2 py-2">
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0ms' }} />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '150ms' }} />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-text-tertiary">생성 시작 중...</p>
          </div>
        ) : null}
      </div>

      {/* ── Selected badge ────────────────────────────────────── */}
      {isSelected && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900">
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <span className="text-xs font-semibold text-zinc-800">
            최적 방향으로 선택됨
          </span>
        </div>
      )}
    </div>
  );
}

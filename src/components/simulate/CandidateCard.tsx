'use client';

import type { CandidateStatus } from '@/hooks/useSimulate';

// ── Constants ───────────────────────────────────────────────────────────────

const INDEX_LABELS = ['A', 'B', 'C'] as const;

const STATUS_TEXT: Record<CandidateStatus, string> = {
  idle: '대기 중',
  streaming: '생성 중...',
  done: '완료',
  error: '오류',
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
      className={`flex flex-col rounded-2xl border p-5 transition-all duration-300 ${
        isSelected
          ? 'border-blue-400 bg-blue-50/50 shadow-md'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Header: label */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            isSelected
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {letter}
        </span>
        <h3 className="text-sm font-semibold text-gray-800">
          방향 {letter}: {label}
        </h3>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          {status === 'streaming' ? (
            <div className="h-full w-full animate-simulate-progress rounded-full bg-blue-400" />
          ) : status === 'done' ? (
            <div className="h-full w-full rounded-full bg-green-400 transition-all duration-500" />
          ) : status === 'error' ? (
            <div className="h-full w-full rounded-full bg-red-400" />
          ) : (
            <div className="h-full w-0 rounded-full bg-gray-300" />
          )}
        </div>
        <p
          className={`mt-1.5 text-xs font-medium ${
            status === 'error' ? 'text-red-500' : 'text-gray-500'
          }`}
        >
          {STATUS_TEXT[status]}
        </p>
      </div>

      {/* Error message */}
      {status === 'error' && error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Content preview */}
      <div className="flex-1 overflow-y-auto">
        {content ? (
          <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {content}
          </p>
        ) : status === 'idle' ? (
          <p className="text-sm text-gray-400">생성 대기 중...</p>
        ) : null}
      </div>

      {/* Selected badge */}
      {isSelected && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>선택됨</span>
        </div>
      )}
    </div>
  );
}

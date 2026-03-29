'use client';

import { useEffect, useRef } from 'react';
import type { Comment } from '@/hooks/useSimulate';

// ── Constants ───────────────────────────────────────────────────────────────

const INDEX_TO_LABEL = ['A안', 'B안', 'C안', 'D안', 'E안'] as const;

const LABEL_COLORS = [
  'bg-zinc-200 text-zinc-800',
  'bg-zinc-100 text-zinc-700',
  'bg-zinc-300 text-zinc-800',
  'bg-zinc-150 text-zinc-700',
  'bg-zinc-200 text-zinc-700',
] as const;

// ── Props ───────────────────────────────────────────────────────────────────

interface AgentCommentProps {
  comments: Comment[];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AgentComment({ comments }: AgentCommentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest comment
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-tertiary">
          <svg
            className="h-3.5 w-3.5 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-text-primary">
          에이전트 메모
        </h3>
        <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-tertiary">
          {comments.length}
        </span>
      </div>

      {/* Comments scroll container */}
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto rounded-2xl border border-border-subtle bg-surface-secondary p-4"
      >
        <div className="flex flex-col gap-3">
          {comments.map((comment, i) => {
            const label = INDEX_TO_LABEL[comment.index] ?? `${comment.index}안`;
            const colorClass =
              LABEL_COLORS[comment.index] ?? 'bg-gray-100 text-gray-700';
            return (
              <div
                key={`comment-${i}`}
                className="animate-question-enter flex items-start gap-3 rounded-xl bg-surface-primary px-4 py-3 shadow-sm"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${colorClass}`}
                >
                  {label}
                </span>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {comment.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

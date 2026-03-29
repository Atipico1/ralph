'use client';

import { useEffect, useRef } from 'react';
import type { Comment } from '@/hooks/useSimulate';

// ── Constants ───────────────────────────────────────────────────────────────

const INDEX_TO_LABEL = ['A안', 'B안', 'C안'] as const;

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
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        에이전트 메모
      </h3>
      <div
        ref={scrollRef}
        className="max-h-40 overflow-y-auto rounded-xl bg-gray-50 p-4"
      >
        <div className="flex flex-col gap-2.5">
          {comments.map((comment, i) => {
            const label = INDEX_TO_LABEL[comment.index] ?? `${comment.index}안`;
            return (
              <div
                key={`comment-${i}`}
                className="animate-question-enter text-sm leading-relaxed text-gray-600"
              >
                <span className="mr-1.5 font-medium text-gray-800">
                  [{label}]
                </span>
                <span className="italic">{comment.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

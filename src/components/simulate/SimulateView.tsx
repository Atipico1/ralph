'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSimulate } from '@/hooks/useSimulate';
import CandidateCard from './CandidateCard';
import AgentComment from './AgentComment';

// ── Constants ───────────────────────────────────────────────────────────────

const CANDIDATE_LABELS = ['감성적 접근', '실용적 접근', '창의적 접근'] as const;

const FADE_OUT_DURATION = 500; // ms, must match animate-page-fade-out

// ── Props ───────────────────────────────────────────────────────────────────

interface SimulateViewProps {
  projectId: string;
  contexts: Array<{ key: string; value: string }>;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SimulateView({
  projectId,
  contexts,
}: SimulateViewProps) {
  const router = useRouter();
  const { candidates, comments, evaluation, isStreaming, isDone, error } =
    useSimulate(projectId);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Context summary: one-line strip of collected keys
  const contextSummary = useMemo(() => {
    if (contexts.length === 0) return '';
    const keys = contexts.map((c) => c.key);
    return keys.join(' / ');
  }, [contexts]);

  // Overall progress: count how many candidates are done
  const doneCount = candidates.filter((c) => c.status === 'done').length;
  const streamingCount = candidates.filter(
    (c) => c.status === 'streaming',
  ).length;

  // When simulation is done, trigger fade-out then navigate
  useEffect(() => {
    if (isDone && !isFadingOut) {
      // Small delay to let user see the evaluation result
      const delayTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 1500);
      return () => clearTimeout(delayTimer);
    }
  }, [isDone, isFadingOut]);

  useEffect(() => {
    if (isFadingOut) {
      const timer = setTimeout(() => {
        router.refresh();
      }, FADE_OUT_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isFadingOut, router]);

  return (
    <main
      className={`flex min-h-screen flex-col px-4 py-8 md:px-8 lg:px-16 ${
        isFadingOut ? 'animate-page-fade-out' : 'animate-simulate-enter'
      }`}
    >
      {/* Top: header with overall progress */}
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            검토 중
          </h1>
          <p className="mb-4 text-sm text-gray-500">
            {isStreaming
              ? `${streamingCount > 0 ? `${streamingCount}개 방향 생성 중...` : '평가 중...'}`
              : isDone
                ? '시뮬레이션 완료'
                : '시작하는 중...'}
          </p>

          {/* Overall progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${(doneCount / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Candidate cards: responsive grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {candidates.map((candidate, index) => (
            <CandidateCard
              key={`candidate-${index}`}
              index={index}
              label={CANDIDATE_LABELS[index]}
              content={candidate.content}
              status={candidate.status}
              isSelected={evaluation?.selectedIndex === index}
              error={candidate.error}
            />
          ))}
        </div>

        {/* Agent comments */}
        <div className="mb-8">
          <AgentComment comments={comments} />
        </div>

        {/* Bottom: context summary strip */}
        {contextSummary && (
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="truncate text-xs text-gray-500">
              <span className="mr-2 font-medium text-gray-600">수집된 맥락:</span>
              {contextSummary}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

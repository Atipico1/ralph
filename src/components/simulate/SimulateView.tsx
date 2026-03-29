'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSimulate } from '@/hooks/useSimulate';
import CandidateCard from './CandidateCard';
import AgentComment from './AgentComment';

// ── Constants ───────────────────────────────────────────────────────────────

const CANDIDATE_LABELS = ['감성적 접근', '실용적 접근', '창의적 접근', '전문적 접근', '스토리텔링 접근'] as const;

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

  const progressPercent = Math.round((doneCount / candidates.length) * 100);

  return (
    <main
      className={`flex min-h-screen flex-col px-5 py-10 md:px-8 lg:px-16 ${
        isFadingOut ? 'animate-page-fade-out' : 'animate-simulate-enter'
      }`}
    >
      <div className="mx-auto w-full max-w-4xl">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            {/* Animated status indicator */}
            <div className="relative flex h-8 w-8 items-center justify-center">
              {isStreaming ? (
                <>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-zinc-500 opacity-20 animate-ping" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-zinc-900" />
                </>
              ) : isDone ? (
                <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              ) : (
                <span className="inline-flex h-3 w-3 rounded-full bg-text-tertiary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                {isDone ? '시뮬레이션 완료' : '검토 중'}
              </h1>
              <p className="mt-0.5 text-sm text-text-secondary">
                {isStreaming
                  ? streamingCount > 0
                    ? `${streamingCount}개 방향 생성 중...`
                    : '평가 중...'
                  : isDone
                    ? '최적의 방향이 선택되었습니다'
                    : '시작하는 중...'}
              </p>
            </div>
          </div>

          {/* Gradient progress bar */}
          <div className="relative">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
              <div
                className="h-full rounded-full bg-zinc-900 transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Progress percentage label */}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-text-tertiary">
                {doneCount}/{candidates.length} 완료
              </span>
              <span className="text-xs font-medium text-zinc-600">
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <p className="text-sm leading-relaxed text-red-700">{error}</p>
          </div>
        )}

        {/* ── Candidate cards grid ────────────────────────────────── */}
        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        {/* ── Agent comments ──────────────────────────────────────── */}
        <div className="mb-10">
          <AgentComment comments={comments} />
        </div>

        {/* ── Context summary strip ───────────────────────────────── */}
        {contextSummary && (
          <div className="rounded-2xl border border-border-subtle bg-surface-secondary px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <svg
                  className="h-4 w-4 text-zinc-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 6h.008v.008H6V6z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-xs font-medium text-text-secondary">
                  수집된 맥락
                </p>
                <p className="truncate text-sm text-text-primary">
                  {contextSummary}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

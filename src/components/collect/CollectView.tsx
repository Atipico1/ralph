'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCollect, type Question, type ContextItem } from '@/hooks/useCollect';
import ChoiceInput from './ChoiceInput';
import TextInput from './TextInput';
import YesNoInput from './YesNoInput';
import FileInput from './FileInput';
import ProgressBar from './ProgressBar';
import ClipboardPanel from './ClipboardPanel';
import NavigationButtons from './NavigationButtons';

interface CollectViewProps {
  projectId: string;
  initialQuestion: Question | null;
  maxQuestions: number;
  initialContexts: Array<{ key: string; value: string }>;
}

export default function CollectView({
  projectId,
  initialQuestion,
  maxQuestions,
  initialContexts,
}: CollectViewProps) {
  const router = useRouter();
  const {
    currentQuestion,
    isLoading,
    isDone,
    error,
    contexts,
    sendMessage,
    uploadFile,
    goBack,
    canGoBack,
    skip,
  } = useCollect(projectId, initialQuestion, initialQuestion?.messageId);

  // Merge initial DB contexts with SSE-collected contexts (no duplicates by key)
  const allContexts = useMemo(
    () => mergeContexts(initialContexts, contexts),
    [initialContexts, contexts],
  );

  // Track questionCount independently to avoid flickering to 0 during transitions
  const lastKnownCount = useRef(initialQuestion?.questionCount ?? 0);
  if (currentQuestion) {
    lastKnownCount.current = currentQuestion.questionCount;
  }
  const questionCount = lastKnownCount.current;

  // When done, refresh to re-fetch project (now in simulate phase)
  useEffect(() => {
    if (isDone) {
      router.refresh();
    }
  }, [isDone, router]);

  function handleSubmit(message: string, optionIndex?: number) {
    void sendMessage(message, optionIndex);
  }

  function handleSkip() {
    void skip();
  }

  const isFirstQuestion = questionCount <= 0;

  return (
    <main className="flex min-h-screen flex-col bg-surface-secondary/30 md:flex-row">
      {/* Left area: question + input + nav */}
      <div className="flex min-h-screen flex-1 flex-col px-5 py-8 pb-20 md:px-10 md:pb-8 lg:px-20">
        {/* Progress bar */}
        <div className="mx-auto w-full max-w-xl">
          <ProgressBar
            questionCount={questionCount}
            maxQuestions={maxQuestions}
          />
        </div>

        {/* Question area (centered vertically) */}
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-8">
          {/* Error */}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 px-5 py-3.5 text-sm text-red-700 shadow-sm">
              <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {error}
            </div>
          )}

          {/* Loading state (between questions) */}
          {isLoading && !currentQuestion && (
            <div className="flex flex-col items-center gap-5 py-16">
              <div className="relative">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-surface-tertiary border-t-zinc-900" />
                <div className="absolute inset-0 h-10 w-10 animate-pulse-soft rounded-full bg-zinc-200/50 blur-md" />
              </div>
              <p className="text-sm font-medium text-text-tertiary">생각하고 있어요...</p>
            </div>
          )}

          {/* Question + Input */}
          {currentQuestion && (
            <div
              key={`${currentQuestion.questionCount}-${currentQuestion.question}`}
              className="animate-question-enter space-y-8"
            >
              {/* Question text */}
              <h2 className="text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
                {currentQuestion.question}
              </h2>

              {/* Input based on type */}
              {currentQuestion.inputType === 'choice' &&
                currentQuestion.options && (
                  <ChoiceInput
                    options={currentQuestion.options}
                    onSubmit={handleSubmit}
                    disabled={isLoading}
                  />
                )}

              {currentQuestion.inputType === 'text' && (
                <TextInput
                  onSubmit={(msg) => handleSubmit(msg)}
                  disabled={isLoading}
                />
              )}

              {currentQuestion.inputType === 'yesno' && (
                <YesNoInput
                  onSubmit={(msg) => handleSubmit(msg)}
                  disabled={isLoading}
                />
              )}

              {currentQuestion.inputType === 'file' && (
                <FileInput
                  onUpload={uploadFile}
                  disabled={isLoading}
                />
              )}

              {/* Loading indicator during request */}
              {isLoading && (
                <div className="flex items-center gap-2.5 text-sm text-text-tertiary">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-surface-tertiary border-t-zinc-600" />
                  <span>다음 질문을 준비하고 있어요...</span>
                </div>
              )}
            </div>
          )}

          {/* No question and not loading — initial empty state */}
          {!currentQuestion && !isLoading && !error && (
            <div className="flex flex-col items-center gap-5 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-surface-tertiary border-t-zinc-900" />
              <p className="text-sm font-medium text-text-tertiary">질문을 불러오는 중입니다...</p>
            </div>
          )}
        </div>

        {/* Navigation buttons (pinned to bottom of left area) */}
        <div className="mx-auto w-full max-w-xl">
          <NavigationButtons
            onPrevious={goBack}
            onSkip={handleSkip}
            canGoBack={canGoBack}
            isLoading={isLoading}
            isFirstQuestion={isFirstQuestion}
          />
        </div>
      </div>

      {/* Right panel: clipboard */}
      <ClipboardPanel contexts={allContexts} />
    </main>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Merge initial (DB) contexts with SSE-collected contexts, deduplicating by key */
function mergeContexts(
  initial: Array<{ key: string; value: string }>,
  collected: ContextItem[],
): Array<{ key: string; value: string }> {
  const seen = new Set<string>();
  const result: Array<{ key: string; value: string }> = [];

  // Initial contexts first
  for (const ctx of initial) {
    if (!seen.has(ctx.key)) {
      seen.add(ctx.key);
      result.push(ctx);
    }
  }

  // Then SSE-collected contexts
  for (const ctx of collected) {
    if (!seen.has(ctx.key)) {
      seen.add(ctx.key);
      result.push(ctx);
    }
  }

  return result;
}

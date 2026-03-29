'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCollect, type Question, type ContextItem } from '@/hooks/useCollect';
import ChoiceInput from './ChoiceInput';
import TextInput from './TextInput';
import YesNoInput from './YesNoInput';
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
    goBack,
    canGoBack,
    skip,
  } = useCollect(projectId, initialQuestion);

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
    <main className="flex min-h-screen flex-col md:flex-row">
      {/* Left area: question + input + nav */}
      <div className="flex min-h-screen flex-1 flex-col px-4 py-8 pb-16 md:px-8 md:pb-8 lg:px-16">
        {/* Progress bar */}
        <div className="mx-auto w-full max-w-xl">
          <ProgressBar
            questionCount={questionCount}
            maxQuestions={maxQuestions}
          />
        </div>

        {/* Question area (centered vertically) */}
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Loading state (between questions) */}
          {isLoading && !currentQuestion && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              <p className="text-sm text-gray-500">생각하고 있어요...</p>
            </div>
          )}

          {/* Question + Input */}
          {currentQuestion && (
            <div
              key={`${currentQuestion.questionCount}-${currentQuestion.question}`}
              className="animate-question-enter space-y-8"
            >
              {/* Question text */}
              <h2 className="text-2xl font-semibold leading-relaxed text-gray-900 sm:text-3xl">
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

              {/* Loading indicator during request */}
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                  <span>다음 질문을 준비하고 있어요...</span>
                </div>
              )}
            </div>
          )}

          {/* No question and not loading — initial empty state */}
          {!currentQuestion && !isLoading && !error && (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="text-gray-500">질문을 불러오는 중입니다...</p>
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

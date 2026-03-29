'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCollect, type Question } from '@/hooks/useCollect';
import ChoiceInput from './ChoiceInput';
import TextInput from './TextInput';
import YesNoInput from './YesNoInput';

interface CollectViewProps {
  projectId: string;
  initialQuestion: Question | null;
}

export default function CollectView({
  projectId,
  initialQuestion,
}: CollectViewProps) {
  const router = useRouter();
  const { currentQuestion, isLoading, isDone, error, sendMessage } =
    useCollect(projectId, initialQuestion);

  // When done, refresh to re-fetch project (now in simulate phase)
  useEffect(() => {
    if (isDone) {
      router.refresh();
    }
  }, [isDone, router]);

  function handleSubmit(message: string, optionIndex?: number) {
    void sendMessage(message, optionIndex);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-8">
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
            key={currentQuestion.questionCount}
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
    </main>
  );
}

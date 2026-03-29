'use client';

import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';

// ── Types ───────────────────────────────────────────────────────────────────

interface RevisionModalProps {
  projectId: string;
  onClose: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function RevisionModal({
  projectId,
  onClose,
}: RevisionModalProps) {
  const router = useRouter();
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch revision options on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchOptions() {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/revision-options`,
        );
        if (!res.ok) throw new Error('옵션을 불러오지 못했습니다.');
        const data: { options: string[] } = await res.json();
        if (!cancelled) {
          setOptions(data.options);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : '옵션을 불러오지 못했습니다.',
          );
          setLoading(false);
        }
      }
    }

    void fetchOptions();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [submitting, onClose]);

  const lastIndex = options.length - 1;

  const handleOptionClick = useCallback(
    (index: number) => {
      if (submitting) return;

      // Last option is always "기타 (직접 입력)"
      if (index === lastIndex) {
        setSelectedOption(null);
        setShowCustomInput(true);
        return;
      }

      setShowCustomInput(false);
      setCustomText('');
      setSelectedOption(options[index]);
    },
    [submitting, lastIndex, options],
  );

  const handleSubmit = useCallback(async () => {
    const finalOption = showCustomInput
      ? customText.trim()
      : selectedOption;
    if (!finalOption || submitting) return;

    setSubmitting(true);
    try {
      const body: { selectedOption: string; customInput?: string } = {
        selectedOption: showCustomInput ? '기타 (직접 입력)' : finalOption,
      };
      if (showCustomInput) {
        body.customInput = finalOption;
      }

      const res = await fetch(`/api/projects/${projectId}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('수정 요청에 실패했습니다.');

      onClose();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '수정 요청에 실패했습니다.',
      );
      setSubmitting(false);
    }
  }, [
    showCustomInput,
    customText,
    selectedOption,
    submitting,
    projectId,
    onClose,
    router,
  ]);

  const handleCustomSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void handleSubmit();
    },
    [handleSubmit],
  );

  const handleBackdropClick = useCallback(() => {
    if (!submitting) onClose();
  }, [submitting, onClose]);

  const canConfirm =
    !submitting &&
    (selectedOption !== null ||
      (showCustomInput && customText.trim().length > 0));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-modal-title"
        className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleBackdropClick}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Title */}
        <h2 id="revision-modal-title" className="mb-4 text-lg font-bold text-gray-900">
          어떤 부분을 수정할까요?
        </h2>

        {/* Content area */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-500">옵션을 불러오는 중...</p>
          </div>
        )}

        {error && !loading && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-3">
            {options.map((option, index) => {
              const isLast = index === lastIndex;
              const isSelected =
                !isLast && selectedOption === option;
              const isCustomActive = isLast && showCustomInput;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleOptionClick(index)}
                  disabled={submitting}
                  className={`w-full rounded-xl border px-6 py-4 text-left text-base text-gray-900 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected || isCustomActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {option}
                </button>
              );
            })}

            {showCustomInput && (
              <form
                onSubmit={handleCustomSubmit}
                className="mt-2 flex gap-2"
              >
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="직접 입력해주세요..."
                  disabled={submitting}
                  autoFocus
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                />
              </form>
            )}
          </div>
        )}

        {/* Confirm button */}
        {!loading && !error && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canConfirm}
              className="rounded-xl bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '요청 중...' : '확인'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

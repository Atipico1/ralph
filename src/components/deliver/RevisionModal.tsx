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
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center animate-dialog-backdrop bg-black/30 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-modal-title"
        className="relative mx-0 sm:mx-4 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-6 sm:p-8 shadow-[0_-4px_32px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] sm:shadow-[0_8px_40px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.03)] animate-modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-gray-200 sm:hidden" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleBackdropClick}
          className="absolute right-4 top-4 sm:right-5 sm:top-5 flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-all duration-200 hover:bg-gray-100 hover:text-gray-500"
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

        {/* Title + subtitle */}
        <div className="mb-6">
          <h2 id="revision-modal-title" className="text-xl font-bold text-gray-900">
            어떤 부분을 수정할까요?
          </h2>
          <p className="mt-1.5 text-[13px] text-gray-400">
            원하는 수정 방향을 선택하면 다시 작성해 드릴게요
          </p>
        </div>

        {/* Content area */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-zinc-900" />
            <p className="text-sm text-gray-400">옵션을 불러오는 중...</p>
          </div>
        )}

        {error && !loading && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/80 px-4 py-3.5 text-sm text-red-600">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-2.5">
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
                  className={`group w-full min-h-[48px] rounded-xl border px-5 py-3.5 text-left text-[15px] leading-relaxed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/15 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected || isCustomActive
                      ? 'border-zinc-900 bg-zinc-50 text-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]'
                      : 'border-gray-150 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/80 active:bg-gray-100/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                      isSelected || isCustomActive
                        ? 'border-zinc-900 bg-zinc-900'
                        : 'border-gray-300 group-hover:border-gray-400'
                    }`}>
                      {(isSelected || isCustomActive) && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    <span>{option}</span>
                  </div>
                </button>
              );
            })}

            {showCustomInput && (
              <form
                onSubmit={handleCustomSubmit}
                className="mt-1"
              >
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="직접 입력해주세요..."
                  disabled={submitting}
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-5 py-3.5 text-[15px] text-gray-900 placeholder-gray-300 transition-all duration-200 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-40"
                />
              </form>
            )}
          </div>
        )}

        {/* Confirm button */}
        {!loading && !error && (
          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleBackdropClick}
              className="rounded-xl px-5 py-2.5 text-[14px] font-medium text-gray-400 transition-colors hover:text-gray-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canConfirm}
              className="min-h-[44px] rounded-xl bg-zinc-900 px-7 py-2.5 text-[14px] font-semibold text-white shadow-zinc-900/15 transition-all duration-200 hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:bg-zinc-300"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  요청 중...
                </span>
              ) : '확인'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

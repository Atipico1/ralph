'use client';

import { useEffect, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  const handleBackdropClick = useCallback(() => {
    onCancel();
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-dialog-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          id="confirm-dialog-title"
          className="mb-2 text-base font-semibold text-gray-900"
        >
          상담 나가기
        </h2>

        {/* Message */}
        <p className="mb-6 text-sm leading-relaxed text-gray-600">
          진행 중인 상담이 있습니다. 나가시겠습니까?
        </p>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600 active:bg-red-700"
          >
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}

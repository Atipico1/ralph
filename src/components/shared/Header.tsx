'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from './ConfirmDialog';

// ── Types ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  phase: 'collect' | 'simulate' | 'deliver';
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Header({ phase }: HeaderProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleHomeClick = useCallback(() => {
    if (phase === 'collect') {
      setShowConfirm(true);
    } else {
      router.push('/');
    }
  }, [phase, router]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    router.push('/');
  }, [router]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-gray-100 bg-white/90 px-4 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={handleHomeClick}
          aria-label="홈으로 이동"
          className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-xl px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
        >
          {/* House icon */}
          <svg
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m3 9.5 9-7 9 7V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 21V12h6v9"
            />
          </svg>
          <span className="text-sm font-medium">Ralph</span>
        </button>
      </header>

      <ConfirmDialog
        isOpen={showConfirm}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </>
  );
}

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
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-100 bg-white/80 px-5 backdrop-blur-xl">
        <button
          type="button"
          onClick={handleHomeClick}
          aria-label="홈으로 이동"
          className="group flex min-h-[44px] min-w-[44px] cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-all duration-200 hover:bg-zinc-50 active:scale-[0.97]"
        >
          <span className="text-[15px] font-bold tracking-tight text-zinc-900">ALJALDAKKALSEN</span>
        </button>

        {/* Phase indicator */}
        <div className="flex items-center gap-1">
          {(['collect', 'simulate', 'deliver'] as const).map((p) => (
            <div
              key={p}
              className={`h-1 rounded-full transition-all duration-300 ${
                p === phase
                  ? 'w-5 bg-zinc-900'
                  : phases.indexOf(p) < phases.indexOf(phase)
                    ? 'w-1.5 bg-zinc-400'
                    : 'w-1.5 bg-zinc-200'
              }`}
            />
          ))}
        </div>
      </header>

      <ConfirmDialog
        isOpen={showConfirm}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </>
  );
}

const phases = ['collect', 'simulate', 'deliver'] as const;

'use client';

import type { ToastState } from '@/hooks/useToast';

// ── Props ───────────────────────────────────────────────────────────────────

interface ToastProps {
  toast: ToastState;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Toast({ toast }: ToastProps) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div
        className={`rounded-full bg-zinc-900 px-5 py-3 text-[14px] font-medium text-white shadow-xl ${
          toast.exiting ? 'animate-toast-exit' : 'animate-toast-enter'
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}

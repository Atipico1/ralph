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
        className={`rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-lg ${
          toast.exiting ? 'animate-toast-exit' : 'animate-toast-enter'
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}

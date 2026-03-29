'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ToastState {
  message: string;
  exiting: boolean;
}

export interface UseToastReturn {
  toast: ToastState | null;
  showToast: (message: string) => void;
}

// ── Constants ───────────────────────────────────────────────────────────────

const TOAST_DURATION = 2500; // ms visible before exit starts
const EXIT_DURATION = 300; // ms for exit animation

// ── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

    // Show toast
    setToast({ message, exiting: false });

    // Start exit animation after duration
    timerRef.current = setTimeout(() => {
      setToast((prev) =>
        prev ? { ...prev, exiting: true } : null,
      );

      // Remove toast after exit animation
      exitTimerRef.current = setTimeout(() => {
        setToast(null);
        exitTimerRef.current = null;
      }, EXIT_DURATION);
    }, TOAST_DURATION);
  }, []);

  return { toast, showToast };
}

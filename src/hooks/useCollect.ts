'use client';

import { useState, useCallback, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Question {
  question: string;
  inputType: 'choice' | 'text' | 'yesno';
  options: string[] | null;
  questionCount: number;
}

export interface ContextItem {
  key: string;
  value: string;
}

interface SSEContextEvent {
  contexts: ContextItem[];
}

interface SSEQuestionEvent {
  question: string;
  inputType: 'choice' | 'text' | 'yesno';
  options: string[] | null;
  questionCount: number;
}

interface SSEDoneEvent {
  done: true;
  phase: string;
}

interface SSEErrorEvent {
  error: string;
}

export interface UseCollectReturn {
  currentQuestion: Question | null;
  isLoading: boolean;
  isDone: boolean;
  error: string | null;
  contexts: ContextItem[];
  sendMessage: (message: string, optionIndex?: number) => Promise<void>;
}

// ── SSE Line Parser ─────────────────────────────────────────────────────────

interface SSEFrame {
  event: string;
  data: string;
}

function parseSSEFrames(raw: string): { frames: SSEFrame[]; remainder: string } {
  const frames: SSEFrame[] = [];
  // Split by double newline (SSE frame delimiter)
  const parts = raw.split('\n\n');
  // Last part may be incomplete
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let event = '';
    let data = '';

    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event: ')) {
        event = line.slice(7);
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }

    if (event && data) {
      frames.push({ event, data });
    }
  }

  return { frames, remainder };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useCollect(
  projectId: string,
  initialQuestion: Question | null,
): UseCollectReturn {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(
    initialQuestion,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contexts, setContexts] = useState<ContextItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string, optionIndex?: number) => {
      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/projects/${projectId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            optionIndex !== undefined ? { message, optionIndex } : { message },
          ),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({
            error: '요청에 실패했습니다.',
          }));
          throw new Error(
            (body as { error?: string }).error ?? '요청에 실패했습니다.',
          );
        }

        if (!res.body) {
          throw new Error('응답 스트림을 열 수 없습니다.');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { frames, remainder } = parseSSEFrames(buffer);
          buffer = remainder;

          for (const frame of frames) {
            switch (frame.event) {
              case 'context': {
                const parsed = JSON.parse(frame.data) as SSEContextEvent;
                if (parsed.contexts.length > 0) {
                  setContexts((prev) => [...prev, ...parsed.contexts]);
                }
                break;
              }
              case 'question': {
                const parsed = JSON.parse(frame.data) as SSEQuestionEvent;
                setCurrentQuestion({
                  question: parsed.question,
                  inputType: parsed.inputType,
                  options: parsed.options,
                  questionCount: parsed.questionCount,
                });
                break;
              }
              case 'done': {
                // Verify it's actually done
                const parsed = JSON.parse(frame.data) as SSEDoneEvent;
                if (parsed.done) {
                  setIsDone(true);
                }
                break;
              }
              case 'error': {
                const parsed = JSON.parse(frame.data) as SSEErrorEvent;
                setError(parsed.error);
                break;
              }
            }
          }
        }

        // Process any remaining buffer after stream ends
        if (buffer.trim()) {
          const { frames } = parseSSEFrames(buffer + '\n\n');
          for (const frame of frames) {
            switch (frame.event) {
              case 'context': {
                const parsed = JSON.parse(frame.data) as SSEContextEvent;
                if (parsed.contexts.length > 0) {
                  setContexts((prev) => [...prev, ...parsed.contexts]);
                }
                break;
              }
              case 'question': {
                const parsed = JSON.parse(frame.data) as SSEQuestionEvent;
                setCurrentQuestion({
                  question: parsed.question,
                  inputType: parsed.inputType,
                  options: parsed.options,
                  questionCount: parsed.questionCount,
                });
                break;
              }
              case 'done': {
                const parsed = JSON.parse(frame.data) as SSEDoneEvent;
                if (parsed.done) {
                  setIsDone(true);
                }
                break;
              }
              case 'error': {
                const parsed = JSON.parse(frame.data) as SSEErrorEvent;
                setError(parsed.error);
                break;
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Intentional abort — not an error
          return;
        }
        const message =
          err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(message);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [projectId],
  );

  return { currentQuestion, isLoading, isDone, error, contexts, sendMessage };
}

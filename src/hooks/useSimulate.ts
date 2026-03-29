'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { parseSSEFrames, type SSEFrame } from '@/lib/sse-parser';

// ── Types ───────────────────────────────────────────────────────────────────

export type CandidateStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface CandidateState {
  content: string;
  status: CandidateStatus;
  error?: string;
}

export interface Comment {
  index: number;
  text: string;
}

export interface Evaluation {
  scores: number[];
  selectedIndex: number;
  rationale: string[];
}

export interface UseSimulateReturn {
  candidates: CandidateState[];
  comments: Comment[];
  evaluation: Evaluation | null;
  isStreaming: boolean;
  isDone: boolean;
  error: string | null;
}

// ── SSE Event Data Types ────────────────────────────────────────────────────

interface SSECandidateEvent {
  index: number;
  chunk: string;
  status: 'streaming' | 'done' | 'error';
  error?: string;
}

interface SSECommentEvent {
  index: number;
  text: string;
}

interface SSEEvaluationEvent {
  scores: number[];
  selectedIndex: number;
  rationale: string[];
}

interface SSEErrorEvent {
  error: string;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSimulate(projectId: string): UseSimulateReturn {
  const [candidates, setCandidates] = useState<CandidateState[]>([
    { content: '', status: 'idle' },
    { content: '', status: 'idle' },
    { content: '', status: 'idle' },
    { content: '', status: 'idle' },
    { content: '', status: 'idle' },
  ]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const handleFrame = useCallback((frame: SSEFrame) => {
    try {
      switch (frame.event) {
        case 'candidate': {
          const parsed = JSON.parse(frame.data) as SSECandidateEvent;
          setCandidates((prev) => {
            const next = [...prev];
            const current = next[parsed.index];
            next[parsed.index] = {
              content: current.content + parsed.chunk,
              status: parsed.status === 'streaming' ? 'streaming' : parsed.status,
              error: parsed.error,
            };
            return next;
          });
          break;
        }
        case 'comment': {
          const parsed = JSON.parse(frame.data) as SSECommentEvent;
          setComments((prev) => [...prev, { index: parsed.index, text: parsed.text }]);
          break;
        }
        case 'evaluation': {
          const parsed = JSON.parse(frame.data) as SSEEvaluationEvent;
          setEvaluation({
            scores: parsed.scores,
            selectedIndex: parsed.selectedIndex,
            rationale: parsed.rationale,
          });
          break;
        }
        case 'done': {
          setIsDone(true);
          break;
        }
        case 'error': {
          const parsed = JSON.parse(frame.data) as SSEErrorEvent;
          setError(parsed.error);
          break;
        }
      }
    } catch {
      // Malformed SSE data — skip frame silently
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    async function start() {
      setIsStreaming(true);
      setError(null);

      try {
        const res = await fetch(`/api/projects/${projectId}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });

        if (!res.ok) {
          const resBody = await res.json().catch(() => ({
            error: '시뮬레이션 요청에 실패했습니다.',
          }));
          throw new Error(
            (resBody as { error?: string }).error ?? '시뮬레이션 요청에 실패했습니다.',
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
            handleFrame(frame);
          }
        }

        // Process any remaining buffer after stream ends
        if (buffer.trim()) {
          const { frames } = parseSSEFrames(buffer + '\n\n');
          for (const frame of frames) {
            handleFrame(frame);
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Cleanup abort — not an error, Strict Mode will re-mount and retry
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMessage);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    }

    void start();

    return () => {
      controller.abort();
    };
  }, [projectId, handleFrame]);

  return {
    candidates,
    comments,
    evaluation,
    isStreaming,
    isDone,
    error,
  };
}

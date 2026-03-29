'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { downloadMarkdown } from '@/lib/download';

// ── Props ───────────────────────────────────────────────────────────────────

interface ActionButtonsProps {
  content: string;
  projectTitle: string;
  projectId: string;
  onSave: () => void;
  onRevise: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ActionButtons({
  content,
  projectTitle,
  projectId,
  onSave,
  onRevise,
}: ActionButtonsProps) {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const handleDownload = useCallback(() => {
    const filename = projectTitle || 'result';
    downloadMarkdown(content, filename);
  }, [content, projectTitle]);

  const handleStartOver = useCallback(async () => {
    const confirmed = window.confirm(
      '처음부터 다시 시작하시겠습니까? 모든 대화와 결과가 초기화됩니다.',
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reset`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('초기화에 실패했습니다.');
      router.push('/');
    } catch {
      setResetting(false);
      window.alert('초기화에 실패했습니다. 다시 시도해주세요.');
    }
  }, [projectId, router]);

  return (
    <section className="flex w-full flex-wrap gap-3">
      {/* Save button — primary */}
      <button
        type="button"
        onClick={onSave}
        className="flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 active:bg-blue-700"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        저장
      </button>

      {/* Download button — secondary */}
      <button
        type="button"
        onClick={handleDownload}
        className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        다운로드
      </button>

      {/* Revise button — secondary */}
      <button
        type="button"
        onClick={onRevise}
        className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M15.2 15.2l.002.001"
          />
        </svg>
        수정 요청
      </button>

      {/* Start over — ghost/danger */}
      <button
        type="button"
        onClick={() => void handleStartOver()}
        disabled={resetting}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
          />
        </svg>
        {resetting ? '초기화 중...' : '처음부터 다시'}
      </button>
    </section>
  );
}

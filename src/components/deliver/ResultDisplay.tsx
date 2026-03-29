'use client';

import { useMemo } from 'react';
import { parseMarkdown } from '@/lib/markdown';

// ── Props ───────────────────────────────────────────────────────────────────

interface ResultDisplayProps {
  content: string;
  label: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ResultDisplay({ content, label }: ResultDisplayProps) {
  const html = useMemo(() => parseMarkdown(content), [content]);

  return (
    <section className="w-full">
      {/* Label badge */}
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-xs font-bold text-white shadow-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
            선택됨
          </span>
        </div>
      </div>

      {/* Prose card */}
      <div
        className="prose prose-neutral max-w-none rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-shadow duration-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] md:p-8 prose-headings:font-semibold prose-headings:text-gray-900 prose-p:leading-[1.75] prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-800"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

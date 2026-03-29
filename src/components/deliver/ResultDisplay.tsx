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
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
          ✓
        </span>
        <h3 className="text-sm font-semibold text-gray-600">{label}</h3>
      </div>
      <div
        className="prose prose-neutral max-w-none rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

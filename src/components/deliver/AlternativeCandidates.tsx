'use client';

import { useState, useMemo } from 'react';
import { parseMarkdown } from '@/lib/markdown';

// ── Types ───────────────────────────────────────────────────────────────────

interface AlternativeCandidate {
  label: string;
  summary: string;
  content: string;
  score: number | null;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface AlternativeCandidatesProps {
  candidates: AlternativeCandidate[];
}

// ── Sub-Component: Expandable card ─────────────────────────────────────────

function CandidateCard({ candidate }: { candidate: AlternativeCandidate }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const html = useMemo(
    () => (isExpanded ? parseMarkdown(candidate.content) : ''),
    [isExpanded, candidate.content],
  );

  return (
    <div className={`rounded-2xl border bg-white transition-all duration-300 ${
      isExpanded
        ? 'border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
        : 'border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-gray-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.05)]'
    }`}>
      {/* Collapsed header -- always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full min-h-[56px] items-center justify-between px-5 py-4 text-left transition-colors duration-200 hover:bg-gray-50/50 rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 text-xs font-bold text-gray-500 ring-1 ring-gray-200/60">
            {candidate.label.charAt(0)}
          </span>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-800">
              {candidate.label}
            </h4>
            <p className="mt-0.5 text-[12px] leading-relaxed text-gray-400 line-clamp-1">{candidate.summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
          {candidate.score !== null && (
            <span className="rounded-lg bg-gray-50 px-2.5 py-1 text-[12px] font-semibold text-gray-500 ring-1 ring-gray-100">
              {candidate.score.toFixed(0)}점
            </span>
          )}
          <svg
            className={`h-4 w-4 text-gray-300 transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-5 py-5">
          <div
            className="prose prose-neutral prose-sm max-w-none prose-p:leading-[1.75] prose-p:text-gray-600 prose-headings:text-gray-800"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AlternativeCandidates({
  candidates,
}: AlternativeCandidatesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (candidates.length === 0) return null;

  return (
    <section className="w-full">
      {/* Divider */}
      <div className="mb-6 border-t border-gray-100" />

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="mb-5 flex items-center gap-2.5 rounded-xl px-1 py-1 text-[14px] font-semibold text-gray-400 transition-all duration-200 hover:text-gray-600"
      >
        <svg
          className={`h-4 w-4 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
        <span>다른 방향도 볼래요?</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          {candidates.length}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3">
          {candidates.map((candidate) => (
            <CandidateCard key={candidate.label} candidate={candidate} />
          ))}
        </div>
      )}
    </section>
  );
}

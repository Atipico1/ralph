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
    <div className="rounded-2xl border border-gray-200 bg-white transition-all duration-200">
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
            {candidate.label.charAt(0)}
          </span>
          <div>
            <h4 className="text-sm font-semibold text-gray-700">
              {candidate.label}
            </h4>
            <p className="mt-0.5 text-xs text-gray-500">{candidate.summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {candidate.score !== null && (
            <span className="text-xs font-medium text-gray-400">
              {candidate.score.toFixed(0)}점
            </span>
          )}
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
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
            className="prose prose-neutral prose-sm max-w-none"
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
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-700"
      >
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${
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
        다른 방향도 볼래요? ({candidates.length}개)
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

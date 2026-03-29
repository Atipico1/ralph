'use client';

import { useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/Toast';
import ResultDisplay from './ResultDisplay';
import RationaleList from './RationaleList';
import ActionButtons from './ActionButtons';
import AlternativeCandidates from './AlternativeCandidates';
import RevisionModal from './RevisionModal';

// ── Types ───────────────────────────────────────────────────────────────────

interface SimulationData {
  id: string;
  label: string;
  summary: string;
  content: string;
  rationale: string;
  score: number | null;
  isSelected: number;
}

interface DeliverViewProps {
  projectId: string;
  projectTitle: string;
  simulations: SimulationData[];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DeliverView({
  projectId,
  projectTitle,
  simulations,
}: DeliverViewProps) {
  const { toast, showToast } = useToast();
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);

  // Separate selected from alternatives
  const selected = useMemo(
    () => simulations.find((s) => s.isSelected === 1) ?? simulations[0],
    [simulations],
  );

  const alternatives = useMemo(
    () =>
      simulations
        .filter((s) => s.id !== selected?.id)
        .map((s) => ({
          label: s.label,
          summary: s.summary,
          content: s.content,
          score: s.score,
        })),
    [simulations, selected],
  );

  const handleSave = useCallback(() => {
    // Data is already persisted during simulate phase.
    // Show confirmation toast.
    showToast('저장되었습니다');
  }, [showToast]);

  const handleOpenRevisionModal = useCallback(() => {
    setRevisionModalOpen(true);
  }, []);

  const handleCloseRevisionModal = useCallback(() => {
    setRevisionModalOpen(false);
  }, []);

  if (!selected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50/50 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
            <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-[15px] text-gray-400">결과물을 찾을 수 없습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white via-gray-50/30 to-gray-50/60 px-4 py-8 md:px-8 lg:px-16 animate-deliver-enter">
      <div className="mx-auto w-full max-w-3xl">
        {/* Progress indicator: complete */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.3)]">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
            <span className="text-[13px] font-semibold text-emerald-600 tracking-wide">완료</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500" />
          </div>
        </div>

        {/* Title */}
        <div className="mb-10">
          <h1 className="text-[26px] font-bold leading-tight text-gray-900 md:text-[28px]">
            이렇게 하는 게<br className="sm:hidden" /> 가장 좋겠어요
          </h1>
          <p className="mt-2 text-[15px] text-gray-400">
            분석 결과를 기반으로 최적의 결과물을 선택했어요
          </p>
        </div>

        {/* Selected result -- markdown rendered */}
        <div className="mb-10">
          <ResultDisplay content={selected.content} label={selected.label} />
        </div>

        {/* Rationale bullets */}
        <div className="mb-10">
          <RationaleList rationale={selected.rationale} />
        </div>

        {/* Action buttons */}
        <div className="mb-12">
          <ActionButtons
            content={selected.content}
            projectTitle={projectTitle}
            projectId={projectId}
            onSave={handleSave}
            onRevise={handleOpenRevisionModal}
          />
        </div>

        {/* Alternative candidates (collapsed) */}
        <div className="mb-8">
          <AlternativeCandidates candidates={alternatives} />
        </div>
      </div>

      {/* Revision modal */}
      {revisionModalOpen && (
        <RevisionModal
          projectId={projectId}
          onClose={handleCloseRevisionModal}
        />
      )}

      {/* Toast notification */}
      {toast && <Toast toast={toast} />}
    </main>
  );
}

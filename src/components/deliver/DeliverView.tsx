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
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-gray-500">결과물을 찾을 수 없습니다.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-4 py-8 md:px-8 lg:px-16 animate-deliver-enter">
      <div className="mx-auto w-full max-w-3xl">
        {/* Progress indicator: complete */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
              ✓
            </span>
            <span className="text-sm font-semibold text-green-600">완료</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full w-full rounded-full bg-green-500 transition-all duration-500" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-8 text-2xl font-bold text-gray-900">
          이렇게 하는 게 가장 좋겠어요
        </h1>

        {/* Selected result — markdown rendered */}
        <div className="mb-8">
          <ResultDisplay content={selected.content} label={selected.label} />
        </div>

        {/* Rationale bullets */}
        <div className="mb-8">
          <RationaleList rationale={selected.rationale} />
        </div>

        {/* Action buttons */}
        <div className="mb-10">
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

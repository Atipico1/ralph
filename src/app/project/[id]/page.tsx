import { notFound } from 'next/navigation';
import {
  getProject,
  getMessagesByProject,
  getCollectedContextByProject,
  getSimulationsByProject,
} from '@/db/queries';
import CollectView from '@/components/collect/CollectView';
import SimulateView from '@/components/simulate/SimulateView';
import DeliverView from '@/components/deliver/DeliverView';
import type { Question } from '@/hooks/useCollect';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  const project = getProject(id);
  if (!project) {
    notFound();
  }

  // ── Collect phase ─────────────────────────────────────────────────────────
  if (project.phase === 'collect') {
    // Find the last agent message to use as initial question
    const messages = getMessagesByProject(id);
    const lastAgentMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'agent');

    let initialQuestion: Question | null = null;
    if (lastAgentMessage) {
      let parsedOptions: string[] | null = null;
      if (lastAgentMessage.options) {
        try {
          parsedOptions = JSON.parse(lastAgentMessage.options) as string[];
        } catch {
          parsedOptions = null;
        }
      }

      initialQuestion = {
        question: lastAgentMessage.content,
        inputType: (lastAgentMessage.inputType ?? 'text') as
          | 'choice'
          | 'text'
          | 'yesno',
        options: parsedOptions,
        questionCount: project.questionCount,
      };
    }

    // Load initial collected contexts from DB
    const collectedContextRows = getCollectedContextByProject(id);
    const initialContexts = collectedContextRows.map((c) => ({
      key: c.key,
      value: c.value,
    }));

    return (
      <CollectView
        projectId={project.id}
        initialQuestion={initialQuestion}
        maxQuestions={project.maxQuestions}
        initialContexts={initialContexts}
      />
    );
  }

  // ── Simulate phase ────────────────────────────────────────────────────────
  if (project.phase === 'simulate') {
    const collectedContextRows = getCollectedContextByProject(id);
    const contexts = collectedContextRows.map((c) => ({
      key: c.key,
      value: c.value,
    }));

    return <SimulateView projectId={project.id} contexts={contexts} />;
  }

  // ── Deliver phase ──────────────────────────────────────────────────────────
  {
    const allSimulations = getSimulationsByProject(id);
    // Get the latest round
    const maxRound = allSimulations.reduce(
      (max, s) => Math.max(max, s.round),
      0,
    );
    // Filter to only the latest round's simulations
    const latestSimulations = allSimulations.filter(
      (s) => s.round === maxRound,
    );

    const simulationData = latestSimulations.map((s) => ({
      id: s.id,
      label: s.label,
      summary: s.summary,
      content: s.content,
      rationale: s.rationale,
      score: s.score,
      isSelected: s.isSelected,
    }));

    return (
      <DeliverView
        projectId={project.id}
        projectTitle={project.title}
        simulations={simulationData}
      />
    );
  }
}

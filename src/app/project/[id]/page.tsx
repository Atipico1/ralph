import { notFound } from 'next/navigation';
import { getProject, getMessagesByProject } from '@/db/queries';
import CollectView from '@/components/collect/CollectView';
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
      const parsedOptions = lastAgentMessage.options
        ? (JSON.parse(lastAgentMessage.options) as string[])
        : null;

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

    return (
      <CollectView projectId={project.id} initialQuestion={initialQuestion} />
    );
  }

  // ── Simulate phase (placeholder) ──────────────────────────────────────────
  if (project.phase === 'simulate') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="mt-4 text-gray-600">
          시뮬레이션 단계입니다. 곧 구현될 예정입니다.
        </p>
      </main>
    );
  }

  // ── Deliver phase (placeholder) ───────────────────────────────────────────
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-bold">{project.title}</h1>
      <p className="mt-4 text-gray-600">
        전달 단계입니다. 곧 구현될 예정입니다.
      </p>
    </main>
  );
}

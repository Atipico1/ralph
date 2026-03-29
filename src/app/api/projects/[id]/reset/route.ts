import {
  getProject,
  deleteCollectedContextByProject,
  deleteMessagesByProject,
  updateProject,
} from '@/db/queries';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Delete collected context and messages
  deleteCollectedContextByProject(id);
  deleteMessagesByProject(id);

  // Reset question count and phase
  updateProject(id, { questionCount: 0, phase: 'collect' });

  return Response.json({ ok: true });
}

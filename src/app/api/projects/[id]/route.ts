import {
  getProject,
  getMessagesByProject,
  getCollectedContextByProject,
  getSimulationsByProject,
} from '@/db/queries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const messages = getMessagesByProject(id);
  const context = getCollectedContextByProject(id);
  const simulations = getSimulationsByProject(id);

  // Parse options JSON in messages for convenience
  const parsedMessages = messages.map((m) => ({
    ...m,
    options: m.options ? (JSON.parse(m.options) as string[]) : null,
  }));

  return Response.json({
    ...project,
    messages: parsedMessages,
    collectedContext: context,
    simulations,
  });
}

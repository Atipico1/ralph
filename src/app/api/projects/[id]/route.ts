import {
  getProject,
  getMessagesByProject,
  getCollectedContextByProject,
  getSimulationsByProject,
} from '@/db/queries';
import { safeParseOptions } from '@/lib/json-safety';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const project = getProject(id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const messages = getMessagesByProject(id);
    const context = getCollectedContextByProject(id);
    const simulations = getSimulationsByProject(id);

    // Parse options JSON in messages for convenience (safe — returns null on corrupted JSON)
    const parsedMessages = messages.map((m) => ({
      ...m,
      options: safeParseOptions(m.options),
    }));

    return Response.json({
      ...project,
      messages: parsedMessages,
      collectedContext: context,
      simulations,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}

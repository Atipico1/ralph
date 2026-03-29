import {
  getProject,
  getMaxRound,
  getSimulationsByProjectAndRound,
} from '@/db/queries';
import { generateRevisionOptions } from '@/ai/revise';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get selected simulation from latest round
  const maxRound = getMaxRound(id);
  if (maxRound === 0) {
    return Response.json(
      { error: 'No simulations found' },
      { status: 400 },
    );
  }

  const roundSims = getSimulationsByProjectAndRound(id, maxRound);
  const selected = roundSims.find((s) => s.isSelected === 1);

  if (!selected) {
    return Response.json(
      { error: 'No selected simulation found' },
      { status: 400 },
    );
  }

  const options = await generateRevisionOptions(
    selected.content,
    project.domain,
  );

  return Response.json({ options });
}

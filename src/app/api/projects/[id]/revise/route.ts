import {
  getProject,
  getMaxRound,
  getSimulationsByProjectAndRound,
  createRevisionOption,
  updateProject,
} from '@/db/queries';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = (await request.json()) as {
    selectedOption?: string;
    customInput?: string;
  };

  if (!body.selectedOption) {
    return Response.json(
      { error: 'selectedOption is required' },
      { status: 400 },
    );
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

  // Save revision option
  createRevisionOption({
    projectId: id,
    simulationId: selected.id,
    selectedOption: body.selectedOption,
    customInput: body.customInput ?? null,
  });

  // Set phase back to simulate for re-simulation
  updateProject(id, { phase: 'simulate' });

  return Response.json({ ok: true });
}

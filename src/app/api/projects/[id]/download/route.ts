import {
  getProject,
  getMaxRound,
  getSimulationsByProjectAndRound,
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

  const filename = `${project.title}.md`;

  return new Response(selected.content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}

import { getProject, getSelectedSimulation } from '@/db/queries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const selected = getSelectedSimulation(id);
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

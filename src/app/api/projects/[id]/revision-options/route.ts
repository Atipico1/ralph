import { getProject, getSelectedSimulation } from '@/db/queries';
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

  const selected = getSelectedSimulation(id);
  if (!selected) {
    return Response.json(
      { error: 'No selected simulation found' },
      { status: 400 },
    );
  }

  try {
    const options = await generateRevisionOptions(
      selected.content,
      project.domain,
    );
    return Response.json({ options });
  } catch {
    return Response.json(
      { error: 'Failed to generate revision options' },
      { status: 500 },
    );
  }
}

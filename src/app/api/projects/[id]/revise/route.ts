import { z } from 'zod';
import {
  getProject,
  getSelectedSimulation,
  createRevisionOption,
  updateProject,
} from '@/db/queries';

const reviseBodySchema = z.object({
  selectedOption: z.string().min(1),
  customInput: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: z.infer<typeof reviseBodySchema>;
  try {
    const raw = await request.json();
    body = reviseBodySchema.parse(raw);
  } catch {
    return Response.json(
      { error: 'Invalid request body: selectedOption is required' },
      { status: 400 },
    );
  }

  // Get selected simulation from latest round
  const selected = getSelectedSimulation(id);
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

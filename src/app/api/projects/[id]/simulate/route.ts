export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
  getProject,
  getCollectedContextByProject,
  getSimulationsByProject,
  getLatestRevisionOption,
  getSimulationsByProjectAndRound,
  createSimulation,
  updateProject,
} from '@/db/queries';
import {
  generateCandidate,
  evaluateCandidates,
  getApproachAngles,
  calculateNextRound,
  buildSummary,
  type CollectedContextItem,
  type RevisionContext,
  type EvaluationResult,
} from '@/ai/simulate';

// ── SSE helpers ─────────────────────────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── POST /api/projects/[id]/simulate ────────────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Validate project
  const project = getProject(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.phase !== 'simulate') {
    return Response.json(
      { error: 'Project is not in simulate phase' },
      { status: 400 },
    );
  }

  if (!project.personaPrompt) {
    return Response.json(
      { error: 'Project persona not initialized' },
      { status: 400 },
    );
  }

  // Load collected context
  const collectedContextRows = getCollectedContextByProject(id);
  const contexts: CollectedContextItem[] = collectedContextRows.map((c) => ({
    key: c.key,
    value: c.value,
  }));

  if (contexts.length === 0) {
    return Response.json(
      { error: 'No collected context found' },
      { status: 400 },
    );
  }

  // Calculate round
  const existingSimulations = getSimulationsByProject(id);
  const round = calculateNextRound(existingSimulations);

  const personaPrompt = project.personaPrompt;
  const domain = project.domain;
  const angles = getApproachAngles(domain);

  // Build revision context for round > 1
  let revisionCtx: RevisionContext | undefined;
  if (round > 1) {
    const latestRevision = getLatestRevisionOption(id);
    const previousRoundSims = getSimulationsByProjectAndRound(id, round - 1);
    const previousSelected = previousRoundSims.find((s) => s.isSelected === 1);

    if (latestRevision && previousSelected) {
      const feedback = latestRevision.customInput ?? latestRevision.selectedOption;
      revisionCtx = {
        previousContent: previousSelected.content,
        revisionFeedback: feedback,
      };
    }
  }

  // Use TransformStream pattern: return Response immediately, do async work
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  async function send(event: string, data: unknown) {
    await writer.write(encoder.encode(sseEvent(event, data)));
  }

  // Start async work (does not block response)
  (async () => {
    try {
      // Start 3 parallel streamText calls
      const streams = angles.map((angle, index) =>
        generateCandidate(index, personaPrompt, contexts, angle, revisionCtx),
      );

      // Accumulated content for each candidate
      const accumulatedContent: string[] = ['', '', ''];
      const candidateErrors: boolean[] = [false, false, false];

      // Drain all 3 streams in parallel
      await Promise.all(
        streams.map(async ({ index, angle, result }) => {
          try {
            for await (const part of result.fullStream) {
              switch (part.type) {
                case 'text-delta': {
                  accumulatedContent[index] += part.textDelta;
                  await send('candidate', {
                    index,
                    chunk: part.textDelta,
                    status: 'streaming',
                  });
                  break;
                }
                case 'tool-call': {
                  if (part.toolName === 'add_comment') {
                    const args = part.args as { comment: string };
                    await send('comment', {
                      index,
                      text: args.comment,
                    });
                  }
                  break;
                }
                // tool-result, finish, etc. — no action needed
              }
            }
            // Send done status for this candidate
            await send('candidate', {
              index,
              chunk: '',
              status: 'done',
            });
          } catch (error: unknown) {
            candidateErrors[index] = true;
            const msg =
              error instanceof Error ? error.message : 'Unknown error';
            await send('candidate', {
              index,
              chunk: '',
              status: 'error',
              error: msg,
            });
          }
        }),
      );

      // Check if all candidates failed
      const successCount = candidateErrors.filter((e) => !e).length;
      if (successCount === 0) {
        await send('error', { error: '모든 후보 생성에 실패했습니다.' });
        await writer.close();
        return;
      }

      // Build candidates array for evaluation (only successful ones)
      const candidatesForEval: {
        index: number;
        label: string;
        content: string;
      }[] = [];
      for (let i = 0; i < 3; i++) {
        if (!candidateErrors[i] && accumulatedContent[i].trim().length > 0) {
          candidatesForEval.push({
            index: i,
            label: angles[i].label,
            content: accumulatedContent[i],
          });
        }
      }

      // Run evaluation
      let evaluation: EvaluationResult;
      try {
        evaluation = await evaluateCandidates(
          domain,
          contexts,
          candidatesForEval.map((c) => ({
            label: c.label,
            content: c.content,
          })),
        );
      } catch {
        // Evaluation failed — select first candidate as default
        evaluation = {
          criteria: [{ name: '종합', weight: 1 }],
          scores: candidatesForEval.map((c, i) => ({
            candidateIndex: c.index,
            criteriaScores: [i === 0 ? 80 : 70],
            totalScore: i === 0 ? 80 : 70,
          })),
          selectedIndex: 0,
          rationale: candidatesForEval.map((_, i) =>
            i === 0
              ? '평가 실패로 첫 번째 후보를 기본 선택합니다.'
              : '평가를 수행하지 못했습니다.',
          ),
        };
      }

      // Build lookup: original index → eval array index
      const originalToEvalIdx = new Map(
        candidatesForEval.map((c, i) => [c.index, i]),
      );

      // Map evaluation selectedIndex back to original candidate index
      const selectedOriginalIndex =
        candidatesForEval[evaluation.selectedIndex]?.index ?? candidatesForEval[0].index;

      // Save simulations to DB
      for (let i = 0; i < 3; i++) {
        const failed = candidateErrors[i];
        const evalIdx = originalToEvalIdx.get(i);
        const evalEntry =
          evalIdx !== undefined ? evaluation.scores[evalIdx] : undefined;

        createSimulation({
          projectId: id,
          round,
          label: angles[i].label,
          summary: failed
            ? '생성 실패'
            : buildSummary(accumulatedContent[i]),
          content: failed ? '' : accumulatedContent[i],
          rationale:
            evalIdx !== undefined
              ? (evaluation.rationale[evalIdx] ?? '')
              : '',
          score: evalEntry?.totalScore ?? null,
          isSelected: i === selectedOriginalIndex ? 1 : 0,
        });
      }

      // Update project phase to deliver
      updateProject(id, { phase: 'deliver' });

      // Build scores array in original index order for SSE
      const scoresForSSE = [0, 1, 2].map((i) => {
        const evalIdx = originalToEvalIdx.get(i);
        return evalIdx !== undefined
          ? (evaluation.scores[evalIdx]?.totalScore ?? 0)
          : 0;
      });

      // Send evaluation event
      await send('evaluation', {
        scores: scoresForSSE,
        selectedIndex: selectedOriginalIndex,
        rationale: evaluation.rationale,
      });

      // Send done event
      await send('done', {});

      await writer.close();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Internal server error';
      try {
        await send('error', { error: msg });
      } catch {
        // Writer may already be closed
      }
      try {
        await writer.close();
      } catch {
        // Already closed
      }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

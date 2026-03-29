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
import {
  firecrawlSearch,
  formatSearchResultsForPrompt,
  type SearchResult,
} from '@/ai/firecrawl';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { collectModel } from '@/ai/providers';

// ── SSE helpers ─────────────────────────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Generate search queries via Cerebras ────────────────────────────────────

const searchQueriesSchema = z.object({
  queries: z.array(z.string().describe('검색 쿼리')).describe('검색 쿼리 3개'),
});

async function generateSearchQueries(
  contexts: CollectedContextItem[],
  domain: string | null,
): Promise<string[]> {
  const contextText = contexts.map((c) => `- ${c.key}: ${c.value}`).join('\n');

  try {
    const { experimental_output: output } = await generateText({
      model: collectModel(),
      experimental_output: Output.object({ schema: searchQueriesSchema }),
      system: `당신은 웹 검색 쿼리 생성기입니다. 주어진 맥락을 바탕으로 결과물 생성에 도움이 될 검색 쿼리 3개를 만드세요.

[규칙]
- 각 쿼리는 서로 다른 관점에서 정보를 수집할 수 있도록 다양하게 생성하세요.
- 한국어와 영어 쿼리를 적절히 섞으세요.
- 각 쿼리는 구체적이고 검색 엔진에 최적화된 형태로 작성하세요.
- 최대 200자 이내로 작성하세요.`,
      prompt: `도메인: ${domain ?? '일반'}\n\n수집된 맥락:\n${contextText}`,
    });

    if (!output || output.queries.length === 0) {
      return [contexts.map((c) => c.value).slice(0, 3).join(' ')];
    }

    return output.queries.slice(0, 3).map((q) => q.slice(0, 200));
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return [contexts.map((c) => c.value).slice(0, 3).join(' ')];
    }
    return [contexts.map((c) => c.value).slice(0, 3).join(' ')];
  }
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
      // 1. Generate search queries (Cerebras, ~0.5s) then fire parallel searches
      const searchQueries = await generateSearchQueries(contexts, domain);

      // All searches in parallel (each returns SearchResult[])
      const searchPromises = searchQueries.map((q) =>
        firecrawlSearch(q).catch(() => [] as SearchResult[]),
      );

      // Wait for all searches (fast — just HTTP calls, no AI)
      const searchResults = await Promise.all(searchPromises);
      const allResults = deduplicateByUrl(searchResults.flat());
      const webSearchContext = formatSearchResultsForPrompt(allResults);

      // 2. Start 5 parallel candidate streams WITH search context
      const streams = angles.map((angle, index) =>
        generateCandidate(
          index,
          personaPrompt,
          contexts,
          angle,
          revisionCtx,
          webSearchContext || undefined,
        ),
      );

      // Accumulated content for each candidate
      const accumulatedContent: string[] = new Array(angles.length).fill('');
      const candidateErrors: boolean[] = new Array(angles.length).fill(false);

      // Drain all candidate streams in parallel
      await Promise.all(
        streams.map(async ({ index, result }) => {
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
              }
            }
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
      for (let i = 0; i < angles.length; i++) {
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

      const selectedOriginalIndex =
        candidatesForEval[evaluation.selectedIndex]?.index ?? candidatesForEval[0].index;

      // Save simulations to DB
      for (let i = 0; i < angles.length; i++) {
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

      const scoresForSSE = Array.from({ length: angles.length }, (_, i) => {
        const evalIdx = originalToEvalIdx.get(i);
        return evalIdx !== undefined
          ? (evaluation.scores[evalIdx]?.totalScore ?? 0)
          : 0;
      });

      await send('evaluation', {
        scores: scoresForSSE,
        selectedIndex: selectedOriginalIndex,
        rationale: evaluation.rationale,
      });

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

// ── Helpers ────────────────────────────────────────────────────────────────

function deduplicateByUrl(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

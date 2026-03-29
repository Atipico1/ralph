import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB queries ─────────────────────────────────────────────────────────

const mockGetProject = vi.fn();
const mockGetCollectedContextByProject = vi.fn();
const mockGetSimulationsByProject = vi.fn();
const mockGetLatestRevisionOption = vi.fn();
const mockGetSimulationsByProjectAndRound = vi.fn();
const mockCreateSimulation = vi.fn();
const mockUpdateProject = vi.fn();

vi.mock('@/db/queries', () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
  getCollectedContextByProject: (...args: unknown[]) =>
    mockGetCollectedContextByProject(...args),
  getSimulationsByProject: (...args: unknown[]) =>
    mockGetSimulationsByProject(...args),
  getLatestRevisionOption: (...args: unknown[]) =>
    mockGetLatestRevisionOption(...args),
  getSimulationsByProjectAndRound: (...args: unknown[]) =>
    mockGetSimulationsByProjectAndRound(...args),
  createSimulation: (...args: unknown[]) => mockCreateSimulation(...args),
  updateSimulation: vi.fn(),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
}));

// ── Mock AI functions ───────────────────────────────────────────────────────

const mockGenerateCandidate = vi.fn();
const mockEvaluateCandidates = vi.fn();

vi.mock('@/ai/simulate', async () => {
  const actual =
    await vi.importActual<typeof import('@/ai/simulate')>('@/ai/simulate');
  return {
    ...actual,
    generateCandidate: (...args: unknown[]) => mockGenerateCandidate(...args),
    evaluateCandidates: (...args: unknown[]) => mockEvaluateCandidates(...args),
  };
});

// ── Mock Agentic Search ───────────────────────────────────────────────────

vi.mock('@/ai/agentic-search', () => ({
  agenticSearch: vi.fn().mockResolvedValue({ summary: '', sources: [] }),
  formatAgenticResultsForPrompt: vi.fn().mockReturnValue(''),
}));

// ── Import route AFTER mocks ────────────────────────────────────────────────

import { POST } from '@/app/api/projects/[id]/simulate/route';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/projects/test-id/simulate', {
    method: 'POST',
  });
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function readSSEEvents(
  response: Response,
): Promise<Array<{ event: string; data: unknown }>> {
  const text = await response.text();
  const events: Array<{ event: string; data: unknown }> = [];

  const blocks = text.split('\n\n').filter((b) => b.trim());
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = '';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7);
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }
    if (event && data) {
      events.push({ event, data: JSON.parse(data) });
    }
  }
  return events;
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const baseProject = {
  id: 'test-id',
  title: 'Test Project',
  domain: 'career_coach',
  personaPrompt: 'You are a career coach',
  phase: 'simulate' as const,
  maxQuestions: 10,
  questionCount: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const collectedContextRows = [
  {
    id: 'ctx-1',
    projectId: 'test-id',
    key: 'target_audience',
    value: '대학생',
    questionId: 'msg-1',
    createdAt: new Date(),
  },
  {
    id: 'ctx-2',
    projectId: 'test-id',
    key: 'budget',
    value: '100만원',
    questionId: 'msg-2',
    createdAt: new Date(),
  },
];

/** Creates a mock fullStream async iterator */
function createMockFullStream(
  textChunks: string[],
  toolCalls: Array<{ comment: string }> = [],
) {
  const events: Array<
    | { type: 'text-delta'; textDelta: string }
    | { type: 'tool-call'; toolName: string; args: { comment: string } }
    | { type: 'finish' }
  > = [];

  for (const chunk of textChunks) {
    events.push({ type: 'text-delta', textDelta: chunk });
  }
  for (const tc of toolCalls) {
    events.push({
      type: 'tool-call',
      toolName: 'add_comment',
      args: { comment: tc.comment },
    });
  }
  events.push({ type: 'finish' });

  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

function setupDefaultMocks() {
  mockGetProject.mockReturnValue(baseProject);
  mockGetCollectedContextByProject.mockReturnValue(collectedContextRows);
  mockGetSimulationsByProject.mockReturnValue([]);
  mockGetLatestRevisionOption.mockReturnValue(undefined);
  mockGetSimulationsByProjectAndRound.mockReturnValue([]);
  mockUpdateProject.mockReturnValue(undefined);

  let simCounter = 0;
  mockCreateSimulation.mockImplementation(
    (data: Record<string, unknown>) => ({
      id: `sim-${simCounter++}`,
      ...data,
      createdAt: new Date(),
    }),
  );

  // Mock 3 parallel candidates
  mockGenerateCandidate.mockImplementation(
    (
      index: number,
      _persona: string,
      _contexts: unknown[],
      angle: { label: string },
    ) => ({
      index,
      angle,
      result: {
        fullStream: createMockFullStream(
          [`후보 ${index} 내용 시작`, ` 이어서 작성`],
          index === 1 ? [{ comment: '이 방향이 좋아 보여요' }] : [],
        ),
      },
    }),
  );

  mockEvaluateCandidates.mockResolvedValue({
    criteria: [
      { name: '목적 적합성', weight: 0.5 },
      { name: '완성도', weight: 0.5 },
    ],
    scores: [
      { candidateIndex: 0, criteriaScores: [85, 80], totalScore: 82.5 },
      { candidateIndex: 1, criteriaScores: [75, 85], totalScore: 80 },
      { candidateIndex: 2, criteriaScores: [70, 75], totalScore: 72.5 },
    ],
    selectedIndex: 0,
    rationale: [
      '감성적 접근이 가장 적합합니다.',
      '실용적이나 감성 부족.',
      '창의적이나 목적에서 벗어남.',
    ],
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/projects/[id]/simulate (contract tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // ── Validation ──────────────────────────────────────────────────────────

  it('returns 404 for non-existent project', async () => {
    mockGetProject.mockReturnValue(undefined);
    const response = await POST(makeRequest(), makeParams('bad-id'));
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Project not found');
  });

  it('returns 400 for project not in simulate phase', async () => {
    mockGetProject.mockReturnValue({ ...baseProject, phase: 'collect' });
    const response = await POST(makeRequest(), makeParams('test-id'));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('not in simulate phase');
  });

  it('returns 400 for project without persona', async () => {
    mockGetProject.mockReturnValue({
      ...baseProject,
      personaPrompt: null,
    });
    const response = await POST(makeRequest(), makeParams('test-id'));
    expect(response.status).toBe(400);
  });

  it('returns 400 when no collected context exists', async () => {
    mockGetCollectedContextByProject.mockReturnValue([]);
    const response = await POST(makeRequest(), makeParams('test-id'));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('No collected context');
  });

  // ── SSE response format ─────────────────────────────────────────────────

  it('returns SSE content-type headers', async () => {
    const response = await POST(makeRequest(), makeParams('test-id'));
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    // Consume stream to avoid hanging
    await response.text();
  });

  // ── Full flow ───────────────────────────────────────────────────────────

  it('sends candidate, comment, evaluation, and done events', async () => {
    const response = await POST(makeRequest(), makeParams('test-id'));
    const events = await readSSEEvents(response);

    // Should have candidate streaming events
    const candidateEvents = events.filter((e) => e.event === 'candidate');
    expect(candidateEvents.length).toBeGreaterThanOrEqual(6); // 2 chunks + 1 done per candidate

    // Should have at least one comment event (from candidate index 1)
    const commentEvents = events.filter((e) => e.event === 'comment');
    expect(commentEvents.length).toBeGreaterThanOrEqual(1);
    const firstComment = commentEvents[0].data as {
      index: number;
      text: string;
    };
    expect(firstComment.text).toBe('이 방향이 좋아 보여요');

    // Should have evaluation event
    const evalEvents = events.filter((e) => e.event === 'evaluation');
    expect(evalEvents).toHaveLength(1);
    const evalData = evalEvents[0].data as {
      scores: number[];
      selectedIndex: number;
      rationale: string[];
    };
    expect(evalData.scores).toHaveLength(3);
    expect(evalData.selectedIndex).toBe(0);
    expect(evalData.rationale).toHaveLength(3);

    // Should have done event
    const doneEvents = events.filter((e) => e.event === 'done');
    expect(doneEvents).toHaveLength(1);
  });

  it('sends candidate events with correct schema', async () => {
    const response = await POST(makeRequest(), makeParams('test-id'));
    const events = await readSSEEvents(response);

    const streamingEvents = events.filter(
      (e) =>
        e.event === 'candidate' &&
        (e.data as { status: string }).status === 'streaming',
    );
    expect(streamingEvents.length).toBeGreaterThan(0);

    const first = streamingEvents[0].data as {
      index: number;
      chunk: string;
      status: string;
    };
    expect(typeof first.index).toBe('number');
    expect(typeof first.chunk).toBe('string');
    expect(first.status).toBe('streaming');

    // Check done events per candidate
    const doneCandidate = events.filter(
      (e) =>
        e.event === 'candidate' &&
        (e.data as { status: string }).status === 'done',
    );
    expect(doneCandidate).toHaveLength(3);
  });

  // ── DB interactions ─────────────────────────────────────────────────────

  it('creates 3 simulation records', async () => {
    const response = await POST(makeRequest(), makeParams('test-id'));
    await response.text();
    expect(mockCreateSimulation).toHaveBeenCalledTimes(3);
  });

  it('saves simulations with correct round', async () => {
    mockGetSimulationsByProject.mockReturnValue([
      { round: 1 },
      { round: 1 },
      { round: 1 },
    ]);
    const response = await POST(makeRequest(), makeParams('test-id'));
    await response.text();

    // Round should be 2
    for (const call of mockCreateSimulation.mock.calls) {
      expect((call[0] as { round: number }).round).toBe(2);
    }
  });

  it('sets is_selected=1 for the winning candidate', async () => {
    const response = await POST(makeRequest(), makeParams('test-id'));
    await response.text();

    const calls = mockCreateSimulation.mock.calls;
    const selectedCalls = calls.filter(
      (c) => (c[0] as { isSelected: number }).isSelected === 1,
    );
    expect(selectedCalls).toHaveLength(1);
  });

  it('updates project phase to deliver', async () => {
    const response = await POST(makeRequest(), makeParams('test-id'));
    await response.text();
    expect(mockUpdateProject).toHaveBeenCalledWith('test-id', {
      phase: 'deliver',
    });
  });

  // ── Round calculation ───────────────────────────────────────────────────

  it('uses round 1 for first simulation', async () => {
    mockGetSimulationsByProject.mockReturnValue([]);
    const response = await POST(makeRequest(), makeParams('test-id'));
    await response.text();

    for (const call of mockCreateSimulation.mock.calls) {
      expect((call[0] as { round: number }).round).toBe(1);
    }
  });

  // ── Error handling: partial candidate failure ───────────────────────────

  it('continues when one candidate fails', async () => {
    mockGenerateCandidate.mockImplementation(
      (
        index: number,
        _persona: string,
        _contexts: unknown[],
        angle: { label: string },
      ) => {
        if (index === 2) {
          return {
            index,
            angle,
            result: {
              fullStream: {
                async *[Symbol.asyncIterator]() {
                  throw new Error('Cerebras timeout');
                },
              },
            },
          };
        }
        return {
          index,
          angle,
          result: {
            fullStream: createMockFullStream([`후보 ${index} 내용`]),
          },
        };
      },
    );

    // Only 2 successful candidates for evaluation
    mockEvaluateCandidates.mockResolvedValue({
      criteria: [{ name: '종합', weight: 1 }],
      scores: [
        { candidateIndex: 0, criteriaScores: [85], totalScore: 85 },
        { candidateIndex: 1, criteriaScores: [75], totalScore: 75 },
      ],
      selectedIndex: 0,
      rationale: ['좋습니다.', '괜찮습니다.'],
    });

    const response = await POST(makeRequest(), makeParams('test-id'));
    const events = await readSSEEvents(response);

    // Should have error event for candidate 2
    const errorCandidates = events.filter(
      (e) =>
        e.event === 'candidate' &&
        (e.data as { status: string }).status === 'error',
    );
    expect(errorCandidates).toHaveLength(1);
    expect(
      (errorCandidates[0].data as { index: number }).index,
    ).toBe(2);

    // Should still have evaluation and done events
    const evalEvents = events.filter((e) => e.event === 'evaluation');
    expect(evalEvents).toHaveLength(1);

    const doneEvents = events.filter((e) => e.event === 'done');
    expect(doneEvents).toHaveLength(1);

    // Should still create 3 simulation records (failed one with empty content)
    expect(mockCreateSimulation).toHaveBeenCalledTimes(3);
  });

  // ── Error handling: all candidates fail ─────────────────────────────────

  it('sends error event when all candidates fail', async () => {
    mockGenerateCandidate.mockImplementation(
      (
        index: number,
        _persona: string,
        _contexts: unknown[],
        angle: { label: string },
      ) => ({
        index,
        angle,
        result: {
          fullStream: {
            async *[Symbol.asyncIterator]() {
              throw new Error('Cerebras down');
            },
          },
        },
      }),
    );

    const response = await POST(makeRequest(), makeParams('test-id'));
    const events = await readSSEEvents(response);

    const errorEvents = events.filter((e) => e.event === 'error');
    expect(errorEvents).toHaveLength(1);
    expect(
      (errorEvents[0].data as { error: string }).error,
    ).toContain('모든 후보 생성에 실패');

    // Should NOT update phase
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });

  // ── 3 parallel calls ───────────────────────────────────────────────────

  it('starts 3 parallel candidate generations', async () => {
    const response = await POST(makeRequest(), makeParams('test-id'));
    await response.text();
    expect(mockGenerateCandidate).toHaveBeenCalledTimes(3);

    // Check indices 0, 1, 2
    const indices = mockGenerateCandidate.mock.calls.map(
      (c) => c[0] as number,
    );
    expect(indices).toEqual([0, 1, 2]);
  });

  it('calls evaluateCandidates after all streams complete', async () => {
    const response = await POST(makeRequest(), makeParams('test-id'));
    await response.text();
    expect(mockEvaluateCandidates).toHaveBeenCalledTimes(1);
  });
});

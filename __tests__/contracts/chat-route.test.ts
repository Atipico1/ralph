import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ── Mock DB queries ─────────────────────────────────────────────────────────

const mockGetProject = vi.fn();
const mockGetMessagesByProject = vi.fn();
const mockGetCollectedContextByProject = vi.fn();
const mockCreateMessage = vi.fn();
const mockCreateCollectedContext = vi.fn();
const mockUpdateProject = vi.fn();

vi.mock('@/db/queries', () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
  getMessagesByProject: (...args: unknown[]) => mockGetMessagesByProject(...args),
  getCollectedContextByProject: (...args: unknown[]) => mockGetCollectedContextByProject(...args),
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
  createCollectedContext: (...args: unknown[]) => mockCreateCollectedContext(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
}));

// ── Mock AI functions ───────────────────────────────────────────────────────

const mockExtractContext = vi.fn();
const mockShouldEndCollectionEarly = vi.fn();
const mockGenerateNextQuestion = vi.fn();

vi.mock('@/ai/collect', async () => {
  const actual = await vi.importActual<typeof import('@/ai/collect')>('@/ai/collect');
  return {
    ...actual,
    extractContext: (...args: unknown[]) => mockExtractContext(...args),
    shouldEndCollectionEarly: (...args: unknown[]) => mockShouldEndCollectionEarly(...args),
    generateNextQuestion: (...args: unknown[]) => mockGenerateNextQuestion(...args),
  };
});

// ── Import route AFTER mocks ────────────────────────────────────────────────

import { POST } from '@/app/api/projects/[id]/chat/route';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/projects/test-id/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function readSSEEvents(response: Response): Promise<Array<{ event: string; data: unknown }>> {
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

// ── Shared project fixture ──────────────────────────────────────────────────

const baseProject = {
  id: 'test-id',
  title: 'Test Project',
  domain: 'career_coach',
  personaPrompt: 'You are a career coach',
  phase: 'collect' as const,
  maxQuestions: 10,
  questionCount: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const agentMessage = {
  id: 'msg-1',
  projectId: 'test-id',
  role: 'agent' as const,
  content: '어떤 직무에 지원하시나요?',
  inputType: 'text' as const,
  options: null,
  createdAt: new Date(),
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/projects/[id]/chat (contract tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockGetProject.mockReturnValue(baseProject);
    mockGetMessagesByProject.mockReturnValue([agentMessage]);
    mockGetCollectedContextByProject.mockReturnValue([]);
    mockCreateMessage.mockReturnValue({ id: 'new-msg', projectId: 'test-id', role: 'user', content: 'test', inputType: null, options: null, createdAt: new Date() });
    mockCreateCollectedContext.mockReturnValue({ id: 'ctx-1', projectId: 'test-id', key: 'role', value: '백엔드 개발자', questionId: 'msg-1', createdAt: new Date() });
    mockUpdateProject.mockReturnValue(undefined);
    mockExtractContext.mockResolvedValue({ contexts: [{ key: 'role', value: '백엔드 개발자' }] });
    mockShouldEndCollectionEarly.mockResolvedValue(false);
    mockGenerateNextQuestion.mockResolvedValue({
      question: '경력은 얼마나 되시나요?',
      inputType: 'choice',
      options: ['1년 미만', '1-3년', '3-5년', '5년 이상', '기타 (직접 입력)'],
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────

  it('returns 400 for invalid JSON', async () => {
    const request = new Request('http://localhost:3000/api/projects/test-id/chat', {
      method: 'POST',
      body: 'not json',
    });
    const response = await POST(request, makeParams('test-id'));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid JSON body');
  });

  it('returns 400 for empty message', async () => {
    const response = await POST(makeRequest({ message: '' }), makeParams('test-id'));
    expect(response.status).toBe(400);
  });

  it('returns 400 for missing message', async () => {
    const response = await POST(makeRequest({}), makeParams('test-id'));
    expect(response.status).toBe(400);
  });

  it('returns 404 for non-existent project', async () => {
    mockGetProject.mockReturnValue(undefined);
    const response = await POST(makeRequest({ message: 'hello' }), makeParams('bad-id'));
    expect(response.status).toBe(404);
  });

  it('returns 400 for project not in collect phase', async () => {
    mockGetProject.mockReturnValue({ ...baseProject, phase: 'simulate' });
    const response = await POST(makeRequest({ message: 'hello' }), makeParams('test-id'));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('not in collect phase');
  });

  it('returns 400 for project without persona', async () => {
    mockGetProject.mockReturnValue({ ...baseProject, personaPrompt: null });
    const response = await POST(makeRequest({ message: 'hello' }), makeParams('test-id'));
    expect(response.status).toBe(400);
  });

  // ── SSE response format ─────────────────────────────────────────────────

  it('returns SSE content-type', async () => {
    const response = await POST(makeRequest({ message: '백엔드 개발자입니다' }), makeParams('test-id'));
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  // ── Normal flow: continue collecting ─────────────────────────────────────

  it('sends context and question events in normal flow', async () => {
    const response = await POST(makeRequest({ message: '백엔드 개발자입니다' }), makeParams('test-id'));
    const events = await readSSEEvents(response);

    expect(events).toHaveLength(2);

    // First event: context
    expect(events[0].event).toBe('context');
    const contextData = events[0].data as { contexts: Array<{ key: string; value: string }> };
    expect(contextData.contexts).toEqual([{ key: 'role', value: '백엔드 개발자' }]);

    // Second event: question (structured data)
    expect(events[1].event).toBe('question');
    const questionData = events[1].data as { question: string; inputType: string; options: string[] | null; questionCount: number };
    expect(questionData.question).toBe('경력은 얼마나 되시나요?');
    expect(questionData.inputType).toBe('choice');
    expect(questionData.options).toContain('기타 (직접 입력)');
    expect(questionData.questionCount).toBe(3);
  });

  it('saves user message to DB', async () => {
    await POST(makeRequest({ message: '백엔드 개발자입니다' }), makeParams('test-id'));
    // Consume the stream
    expect(mockCreateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'test-id',
        role: 'user',
        content: '백엔드 개발자입니다',
      }),
    );
  });

  it('saves extracted context to DB', async () => {
    const response = await POST(makeRequest({ message: '백엔드 개발자입니다' }), makeParams('test-id'));
    await response.text(); // consume stream
    expect(mockCreateCollectedContext).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'test-id',
        key: 'role',
        value: '백엔드 개발자',
        questionId: 'msg-1',
      }),
    );
  });

  it('increments question_count', async () => {
    const response = await POST(makeRequest({ message: '백엔드 개발자입니다' }), makeParams('test-id'));
    await response.text();
    expect(mockUpdateProject).toHaveBeenCalledWith('test-id', { questionCount: 3 });
  });

  it('saves agent question to DB', async () => {
    const response = await POST(makeRequest({ message: '백엔드 개발자입니다' }), makeParams('test-id'));
    await response.text();

    // Should save agent message (2nd call to createMessage)
    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
    expect(mockCreateMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'test-id',
        role: 'agent',
        content: '경력은 얼마나 되시나요?',
        inputType: 'choice',
      }),
    );
  });

  // ── Done flow: max questions reached ──────────────────────────────────────

  it('sends done event when max questions reached', async () => {
    mockGetProject.mockReturnValue({ ...baseProject, questionCount: 9, maxQuestions: 10 });
    const response = await POST(makeRequest({ message: '네' }), makeParams('test-id'));
    const events = await readSSEEvents(response);

    // Should have context + done events
    const doneEvent = events.find((e) => e.event === 'done');
    expect(doneEvent).toBeDefined();
    const doneData = doneEvent!.data as { done: boolean; phase: string };
    expect(doneData.done).toBe(true);
    expect(doneData.phase).toBe('simulate');
  });

  it('updates phase to simulate when done', async () => {
    mockGetProject.mockReturnValue({ ...baseProject, questionCount: 9, maxQuestions: 10 });
    const response = await POST(makeRequest({ message: '네' }), makeParams('test-id'));
    await response.text();

    expect(mockUpdateProject).toHaveBeenCalledWith('test-id', { phase: 'simulate' });
  });

  // ── Done flow: early termination ──────────────────────────────────────────

  it('sends done event when AI decides to end early', async () => {
    mockShouldEndCollectionEarly.mockResolvedValue(true);
    const response = await POST(makeRequest({ message: '모든 정보 드렸어요' }), makeParams('test-id'));
    const events = await readSSEEvents(response);

    const doneEvent = events.find((e) => e.event === 'done');
    expect(doneEvent).toBeDefined();
  });

  // ── Edge case: no context extracted ───────────────────────────────────────

  it('handles empty context extraction gracefully', async () => {
    mockExtractContext.mockResolvedValue({ contexts: [] });
    const response = await POST(makeRequest({ message: '잘 모르겠어요' }), makeParams('test-id'));
    const events = await readSSEEvents(response);

    const contextEvent = events.find((e) => e.event === 'context');
    expect(contextEvent).toBeDefined();
    const contextData = contextEvent!.data as { contexts: unknown[] };
    expect(contextData.contexts).toEqual([]);
    expect(mockCreateCollectedContext).not.toHaveBeenCalled();
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('sends error event on AI failure', async () => {
    mockExtractContext.mockRejectedValue(new Error('AI service unavailable'));
    const response = await POST(makeRequest({ message: 'test' }), makeParams('test-id'));
    const events = await readSSEEvents(response);

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    const errorData = errorEvent!.data as { error: string };
    expect(errorData.error).toBe('AI service unavailable');
  });

  // ── Request schema contract ───────────────────────────────────────────────

  it('accepts valid body with optionIndex', async () => {
    const schema = z.object({
      message: z.string().min(1),
      optionIndex: z.number().int().min(0).optional(),
    });
    const result = schema.safeParse({ message: 'hello', optionIndex: 2 });
    expect(result.success).toBe(true);
  });

  it('rejects negative optionIndex', async () => {
    const schema = z.object({
      message: z.string().min(1),
      optionIndex: z.number().int().min(0).optional(),
    });
    const result = schema.safeParse({ message: 'hello', optionIndex: -1 });
    expect(result.success).toBe(false);
  });
});

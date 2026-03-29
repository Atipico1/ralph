import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB queries ─────────────────────────────────────────────────────────

const mockGetProject = vi.fn();
const mockGetSelectedSimulation = vi.fn();
const mockCreateRevisionOption = vi.fn();
const mockUpdateProject = vi.fn();
const mockDeleteRevisionOptionsByProject = vi.fn();
const mockDeleteSimulationsByProject = vi.fn();
const mockDeleteCollectedContextByProject = vi.fn();
const mockDeleteMessagesByProject = vi.fn();

vi.mock('@/db/queries', () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
  getSelectedSimulation: (...args: unknown[]) =>
    mockGetSelectedSimulation(...args),
  createRevisionOption: (...args: unknown[]) =>
    mockCreateRevisionOption(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteRevisionOptionsByProject: (...args: unknown[]) =>
    mockDeleteRevisionOptionsByProject(...args),
  deleteSimulationsByProject: (...args: unknown[]) =>
    mockDeleteSimulationsByProject(...args),
  deleteCollectedContextByProject: (...args: unknown[]) =>
    mockDeleteCollectedContextByProject(...args),
  deleteMessagesByProject: (...args: unknown[]) =>
    mockDeleteMessagesByProject(...args),
}));

// ── Mock AI functions ───────────────────────────────────────────────────────

const mockGenerateRevisionOptions = vi.fn();

vi.mock('@/ai/revise', () => ({
  generateRevisionOptions: (...args: unknown[]) =>
    mockGenerateRevisionOptions(...args),
}));

// ── Import routes AFTER mocks ──────────────────────────────────────────────

import { GET as getRevisionOptions } from '@/app/api/projects/[id]/revision-options/route';
import { POST as postRevise } from '@/app/api/projects/[id]/revise/route';
import { GET as getDownload } from '@/app/api/projects/[id]/download/route';
import { POST as postReset } from '@/app/api/projects/[id]/reset/route';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(path: string): Request {
  return new Request(`http://localhost:3000${path}`, { method: 'GET' });
}

function makePostRequest(path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const baseProject = {
  id: 'test-id',
  title: 'Test Project',
  domain: 'career_coach',
  personaPrompt: 'You are a career coach',
  phase: 'deliver' as const,
  maxQuestions: 10,
  questionCount: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const selectedSimulation = {
  id: 'sim-1',
  projectId: 'test-id',
  round: 1,
  candidateIndex: 0,
  angle: '감성적 접근',
  content: '# 테스트 콘텐츠\n\n이것은 시뮬레이션 결과물입니다.',
  isSelected: 1,
  evaluationScore: 85,
  evaluationRationale: '좋습니다.',
  createdAt: new Date(),
};

// ── Tests: GET /api/projects/[id]/revision-options ──────────────────────────

describe('GET /api/projects/[id]/revision-options (contract tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockReturnValue(baseProject);
    mockGetSelectedSimulation.mockReturnValue(selectedSimulation);
    mockGenerateRevisionOptions.mockResolvedValue([
      '톤 변경',
      '분량 조절',
      '구조 변경',
      '핵심 내용 수정',
      '기타 (직접 입력)',
    ]);
  });

  it('returns 404 when project not found', async () => {
    mockGetProject.mockReturnValue(undefined);
    const response = await getRevisionOptions(
      makeGetRequest('/api/projects/bad-id/revision-options'),
      makeParams('bad-id'),
    );
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Project not found');
  });

  it('returns 400 when no selected simulation', async () => {
    mockGetSelectedSimulation.mockReturnValue(undefined);
    const response = await getRevisionOptions(
      makeGetRequest('/api/projects/test-id/revision-options'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('No selected simulation');
  });

  it('returns { options: string[] } with valid options', async () => {
    const response = await getRevisionOptions(
      makeGetRequest('/api/projects/test-id/revision-options'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { options: string[] };
    expect(Array.isArray(json.options)).toBe(true);
    expect(json.options).toHaveLength(5);
    expect(json.options).toContain('톤 변경');
  });

  it('options array always ends with "기타 (직접 입력)"', async () => {
    const response = await getRevisionOptions(
      makeGetRequest('/api/projects/test-id/revision-options'),
      makeParams('test-id'),
    );
    const json = (await response.json()) as { options: string[] };
    expect(json.options[json.options.length - 1]).toBe('기타 (직접 입력)');
  });

  it('returns 500 when AI generation fails', async () => {
    mockGenerateRevisionOptions.mockRejectedValue(
      new Error('AI service unavailable'),
    );
    const response = await getRevisionOptions(
      makeGetRequest('/api/projects/test-id/revision-options'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain('Failed to generate revision options');
  });
});

// ── Tests: POST /api/projects/[id]/revise ───────────────────────────────────

describe('POST /api/projects/[id]/revise (contract tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockReturnValue(baseProject);
    mockGetSelectedSimulation.mockReturnValue(selectedSimulation);
    mockCreateRevisionOption.mockReturnValue({
      id: 'rev-1',
      projectId: 'test-id',
      simulationId: 'sim-1',
      selectedOption: '톤 변경',
      customInput: null,
      createdAt: new Date(),
    });
    mockUpdateProject.mockReturnValue(undefined);
  });

  it('returns 404 when project not found', async () => {
    mockGetProject.mockReturnValue(undefined);
    const response = await postRevise(
      makePostRequest('/api/projects/bad-id/revise', {
        selectedOption: '톤 변경',
      }),
      makeParams('bad-id'),
    );
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Project not found');
  });

  it('returns 400 when body is missing selectedOption', async () => {
    const response = await postRevise(
      makePostRequest('/api/projects/test-id/revise', {}),
      makeParams('test-id'),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('selectedOption');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const request = new Request(
      'http://localhost:3000/api/projects/test-id/revise',
      { method: 'POST', body: 'not json' },
    );
    const response = await postRevise(request, makeParams('test-id'));
    expect(response.status).toBe(400);
  });

  it('returns 400 when selectedOption is empty string', async () => {
    const response = await postRevise(
      makePostRequest('/api/projects/test-id/revise', {
        selectedOption: '',
      }),
      makeParams('test-id'),
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when no selected simulation found', async () => {
    mockGetSelectedSimulation.mockReturnValue(undefined);
    const response = await postRevise(
      makePostRequest('/api/projects/test-id/revise', {
        selectedOption: '톤 변경',
      }),
      makeParams('test-id'),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('No selected simulation');
  });

  it('returns { ok: true } on success', async () => {
    const response = await postRevise(
      makePostRequest('/api/projects/test-id/revise', {
        selectedOption: '톤 변경',
      }),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('calls createRevisionOption with correct data', async () => {
    await postRevise(
      makePostRequest('/api/projects/test-id/revise', {
        selectedOption: '톤 변경',
        customInput: '좀 더 부드럽게',
      }),
      makeParams('test-id'),
    );
    expect(mockCreateRevisionOption).toHaveBeenCalledWith({
      projectId: 'test-id',
      simulationId: 'sim-1',
      selectedOption: '톤 변경',
      customInput: '좀 더 부드럽게',
    });
  });

  it('calls createRevisionOption with null customInput when not provided', async () => {
    await postRevise(
      makePostRequest('/api/projects/test-id/revise', {
        selectedOption: '구조 변경',
      }),
      makeParams('test-id'),
    );
    expect(mockCreateRevisionOption).toHaveBeenCalledWith({
      projectId: 'test-id',
      simulationId: 'sim-1',
      selectedOption: '구조 변경',
      customInput: null,
    });
  });

  it('calls updateProject to set phase="simulate"', async () => {
    await postRevise(
      makePostRequest('/api/projects/test-id/revise', {
        selectedOption: '톤 변경',
      }),
      makeParams('test-id'),
    );
    expect(mockUpdateProject).toHaveBeenCalledWith('test-id', {
      phase: 'simulate',
    });
  });
});

// ── Tests: GET /api/projects/[id]/download ──────────────────────────────────

describe('GET /api/projects/[id]/download (contract tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockReturnValue(baseProject);
    mockGetSelectedSimulation.mockReturnValue(selectedSimulation);
  });

  it('returns 404 when project not found', async () => {
    mockGetProject.mockReturnValue(undefined);
    const response = await getDownload(
      makeGetRequest('/api/projects/bad-id/download'),
      makeParams('bad-id'),
    );
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Project not found');
  });

  it('returns 400 when no selected simulation', async () => {
    mockGetSelectedSimulation.mockReturnValue(undefined);
    const response = await getDownload(
      makeGetRequest('/api/projects/test-id/download'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('No selected simulation');
  });

  it('returns response with Content-Type: text/markdown', async () => {
    const response = await getDownload(
      makeGetRequest('/api/projects/test-id/download'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
    const contentType = response.headers.get('Content-Type');
    expect(contentType).toContain('text/markdown');
  });

  it('returns response with Content-Disposition header', async () => {
    const response = await getDownload(
      makeGetRequest('/api/projects/test-id/download'),
      makeParams('test-id'),
    );
    const disposition = response.headers.get('Content-Disposition');
    expect(disposition).toBeTruthy();
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('Test%20Project.md');
  });

  it('response body is the simulation content', async () => {
    const response = await getDownload(
      makeGetRequest('/api/projects/test-id/download'),
      makeParams('test-id'),
    );
    const text = await response.text();
    expect(text).toBe(selectedSimulation.content);
  });
});

// ── Tests: POST /api/projects/[id]/reset ────────────────────────────────────

describe('POST /api/projects/[id]/reset (contract tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockReturnValue(baseProject);
    mockDeleteRevisionOptionsByProject.mockReturnValue(undefined);
    mockDeleteSimulationsByProject.mockReturnValue(undefined);
    mockDeleteCollectedContextByProject.mockReturnValue(undefined);
    mockDeleteMessagesByProject.mockReturnValue(undefined);
    mockUpdateProject.mockReturnValue(undefined);
  });

  it('returns 404 when project not found', async () => {
    mockGetProject.mockReturnValue(undefined);
    const response = await postReset(
      makePostRequest('/api/projects/bad-id/reset'),
      makeParams('bad-id'),
    );
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Project not found');
  });

  it('returns { ok: true } on success', async () => {
    const response = await postReset(
      makePostRequest('/api/projects/test-id/reset'),
      makeParams('test-id'),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('calls deleteRevisionOptionsByProject', async () => {
    await postReset(
      makePostRequest('/api/projects/test-id/reset'),
      makeParams('test-id'),
    );
    expect(mockDeleteRevisionOptionsByProject).toHaveBeenCalledWith('test-id');
  });

  it('calls deleteSimulationsByProject', async () => {
    await postReset(
      makePostRequest('/api/projects/test-id/reset'),
      makeParams('test-id'),
    );
    expect(mockDeleteSimulationsByProject).toHaveBeenCalledWith('test-id');
  });

  it('calls deleteCollectedContextByProject', async () => {
    await postReset(
      makePostRequest('/api/projects/test-id/reset'),
      makeParams('test-id'),
    );
    expect(mockDeleteCollectedContextByProject).toHaveBeenCalledWith(
      'test-id',
    );
  });

  it('calls deleteMessagesByProject', async () => {
    await postReset(
      makePostRequest('/api/projects/test-id/reset'),
      makeParams('test-id'),
    );
    expect(mockDeleteMessagesByProject).toHaveBeenCalledWith('test-id');
  });

  it('calls updateProject with { questionCount: 0, phase: "collect" }', async () => {
    await postReset(
      makePostRequest('/api/projects/test-id/reset'),
      makeParams('test-id'),
    );
    expect(mockUpdateProject).toHaveBeenCalledWith('test-id', {
      questionCount: 0,
      phase: 'collect',
    });
  });

  it('deletes revision options before simulations (FK order)', async () => {
    const callOrder: string[] = [];
    mockDeleteRevisionOptionsByProject.mockImplementation(() => {
      callOrder.push('revisionOptions');
    });
    mockDeleteSimulationsByProject.mockImplementation(() => {
      callOrder.push('simulations');
    });
    mockDeleteCollectedContextByProject.mockImplementation(() => {
      callOrder.push('collectedContext');
    });
    mockDeleteMessagesByProject.mockImplementation(() => {
      callOrder.push('messages');
    });

    await postReset(
      makePostRequest('/api/projects/test-id/reset'),
      makeParams('test-id'),
    );

    const revIdx = callOrder.indexOf('revisionOptions');
    const simIdx = callOrder.indexOf('simulations');
    expect(revIdx).toBeLessThan(simIdx);
  });
});

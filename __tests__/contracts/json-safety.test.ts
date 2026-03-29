import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeParseOptions, safeStringifyOptions } from '@/lib/json-safety';

describe('safeParseOptions (contract tests)', () => {
  it('returns parsed array for valid JSON string array', () => {
    const json = JSON.stringify(['Option A', 'Option B', '기타 (직접 입력)']);
    expect(safeParseOptions(json)).toEqual(['Option A', 'Option B', '기타 (직접 입력)']);
  });

  it('returns null for null input', () => {
    expect(safeParseOptions(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseOptions('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(safeParseOptions('{not valid json')).toBeNull();
  });

  it('returns null for valid JSON but not an array', () => {
    expect(safeParseOptions(JSON.stringify({ key: 'value' }))).toBeNull();
  });

  it('returns null for valid JSON string (not array)', () => {
    expect(safeParseOptions(JSON.stringify('just a string'))).toBeNull();
  });

  it('returns null for array with non-string items', () => {
    expect(safeParseOptions(JSON.stringify([1, 2, 3]))).toBeNull();
  });

  it('returns null for mixed array (strings and numbers)', () => {
    expect(safeParseOptions(JSON.stringify(['valid', 42]))).toBeNull();
  });

  it('returns empty array for valid empty JSON array', () => {
    expect(safeParseOptions(JSON.stringify([]))).toEqual([]);
  });
});

describe('safeStringifyOptions (contract tests)', () => {
  it('returns JSON string for valid string array', () => {
    const options = ['Option A', 'Option B'];
    expect(safeStringifyOptions(options)).toBe(JSON.stringify(options));
  });

  it('returns null for null input', () => {
    expect(safeStringifyOptions(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(safeStringifyOptions(undefined)).toBeNull();
  });

  it('returns null for non-array input (object)', () => {
    expect(safeStringifyOptions({ key: 'value' })).toBeNull();
  });

  it('returns null for non-array input (string)', () => {
    expect(safeStringifyOptions('not an array')).toBeNull();
  });

  it('returns null for array with non-string items', () => {
    expect(safeStringifyOptions([1, 2, 3])).toBeNull();
  });

  it('returns null for mixed array', () => {
    expect(safeStringifyOptions(['valid', 42])).toBeNull();
  });

  it('returns JSON string for empty array', () => {
    expect(safeStringifyOptions([])).toBe('[]');
  });
});

// ── Route integration: GET /api/projects/[id] with corrupted options ────────

const mockGetProject = vi.fn();
const mockGetMessagesByProject = vi.fn();
const mockGetCollectedContextByProject = vi.fn();
const mockGetSimulationsByProject = vi.fn();

vi.mock('@/db/queries', () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
  getMessagesByProject: (...args: unknown[]) => mockGetMessagesByProject(...args),
  getCollectedContextByProject: (...args: unknown[]) => mockGetCollectedContextByProject(...args),
  getSimulationsByProject: (...args: unknown[]) => mockGetSimulationsByProject(...args),
}));

import { GET } from '@/app/api/projects/[id]/route';

describe('GET /api/projects/[id] — corrupted JSON options (contract test)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with null options when DB contains corrupted JSON', async () => {
    mockGetProject.mockReturnValue({
      id: 'test-id',
      title: 'Test',
      domain: 'general',
      phase: 'collect',
      maxQuestions: 10,
      questionCount: 1,
    });
    mockGetMessagesByProject.mockReturnValue([
      {
        id: 'msg-1',
        projectId: 'test-id',
        role: 'agent',
        content: 'Hello',
        inputType: 'choice',
        options: '{corrupted json!!!',
        createdAt: new Date(),
      },
    ]);
    mockGetCollectedContextByProject.mockReturnValue([]);
    mockGetSimulationsByProject.mockReturnValue([]);

    const request = new Request('http://localhost:3000/api/projects/test-id');
    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.messages).toHaveLength(1);
    expect(json.messages[0].options).toBeNull();
  });

  it('returns 200 with parsed options when DB contains valid JSON', async () => {
    const validOptions = ['A', 'B', '기타 (직접 입력)'];
    mockGetProject.mockReturnValue({
      id: 'test-id',
      title: 'Test',
      domain: 'general',
      phase: 'collect',
      maxQuestions: 10,
      questionCount: 1,
    });
    mockGetMessagesByProject.mockReturnValue([
      {
        id: 'msg-1',
        projectId: 'test-id',
        role: 'agent',
        content: 'Hello',
        inputType: 'choice',
        options: JSON.stringify(validOptions),
        createdAt: new Date(),
      },
    ]);
    mockGetCollectedContextByProject.mockReturnValue([]);
    mockGetSimulationsByProject.mockReturnValue([]);

    const request = new Request('http://localhost:3000/api/projects/test-id');
    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.messages[0].options).toEqual(validOptions);
  });

  it('returns 200 with null when options is non-string-array JSON', async () => {
    mockGetProject.mockReturnValue({
      id: 'test-id',
      title: 'Test',
      domain: 'general',
      phase: 'collect',
      maxQuestions: 10,
      questionCount: 1,
    });
    mockGetMessagesByProject.mockReturnValue([
      {
        id: 'msg-1',
        projectId: 'test-id',
        role: 'agent',
        content: 'Hello',
        inputType: 'choice',
        options: JSON.stringify({ notAnArray: true }),
        createdAt: new Date(),
      },
    ]);
    mockGetCollectedContextByProject.mockReturnValue([]);
    mockGetSimulationsByProject.mockReturnValue([]);

    const request = new Request('http://localhost:3000/api/projects/test-id');
    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.messages[0].options).toBeNull();
  });
});

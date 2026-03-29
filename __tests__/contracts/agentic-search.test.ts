import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock providers — prevent real API calls
// ---------------------------------------------------------------------------

vi.mock('@/ai/providers', () => ({
  mainAgentModel: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock firecrawl primitives
// ---------------------------------------------------------------------------

const mockFirecrawlSearch = vi.fn();
const mockFirecrawlScrape = vi.fn();

vi.mock('@/ai/firecrawl', () => ({
  firecrawlSearch: (...args: unknown[]) => mockFirecrawlSearch(...args),
  firecrawlScrape: (...args: unknown[]) => mockFirecrawlScrape(...args),
}));

// ---------------------------------------------------------------------------
// Mock AI SDK generateText — simulate ReAct tool-calling loop
// ---------------------------------------------------------------------------

const mockGenerateText = vi.fn();

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: (...args: unknown[]) => mockGenerateText(...args),
  };
});

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import {
  agenticSearch,
  formatAgenticResultsForPrompt,
} from '@/ai/agentic-search';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv('FIRECRAWL_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// agenticSearch
// ---------------------------------------------------------------------------

describe('agenticSearch (contract tests)', () => {
  it('returns empty result when FIRECRAWL_API_KEY is missing', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', '');
    delete process.env.FIRECRAWL_API_KEY;

    const result = await agenticSearch([{ key: 'topic', value: 'test' }]);
    expect(result).toEqual({ summary: '', sources: [] });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('calls generateText with webSearch and scrapeUrl tools', async () => {
    mockGenerateText.mockResolvedValue({ text: '검색 결과 요약' });

    await agenticSearch(
      [{ key: 'destination', value: '도쿄' }],
      '여행 계획',
    );

    expect(mockGenerateText).toHaveBeenCalledTimes(1);

    const callArgs = mockGenerateText.mock.calls[0][0] as {
      tools: Record<string, unknown>;
      maxSteps: number;
      system: string;
      prompt: string;
    };

    // Tools contract: webSearch and scrapeUrl must be present
    expect(callArgs.tools).toHaveProperty('webSearch');
    expect(callArgs.tools).toHaveProperty('scrapeUrl');

    // maxSteps enables ReAct loop
    expect(callArgs.maxSteps).toBeGreaterThanOrEqual(3);

    // Prompt includes context
    expect(callArgs.prompt).toContain('도쿄');
    expect(callArgs.prompt).toContain('여행 계획');
  });

  it('returns summary and deduplicated sources', async () => {
    // Simulate tool calls populating collectedSources via side effects
    mockFirecrawlSearch.mockResolvedValue([
      { url: 'https://a.com', title: 'A', description: 'Desc A' },
      { url: 'https://b.com', title: 'B', description: 'Desc B' },
    ]);

    // generateText calls the tool execute functions internally;
    // we simulate the final result with the text
    mockGenerateText.mockImplementation(
      async (opts: { tools: Record<string, { execute: (args: Record<string, string>) => Promise<unknown> }> }) => {
        // Simulate LLM calling webSearch tool
        await opts.tools.webSearch.execute({ query: '도쿄 여행' });
        // Simulate LLM calling webSearch again (ReAct: second search)
        await opts.tools.webSearch.execute({ query: 'Tokyo travel tips' });
        return { text: '도쿄 여행 정보 요약입니다.' };
      },
    );

    const result = await agenticSearch([
      { key: 'destination', value: '도쿄' },
    ]);

    expect(result.summary).toBe('도쿄 여행 정보 요약입니다.');
    // Should be deduplicated (a.com and b.com from both calls, only 2 unique)
    expect(result.sources).toHaveLength(2);
    expect(result.sources.map((s) => s.url)).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('includes scrape results in sources', async () => {
    mockFirecrawlSearch.mockResolvedValue([
      { url: 'https://a.com', title: 'A', description: 'Desc A' },
    ]);
    mockFirecrawlScrape.mockResolvedValue({
      markdown: '# Detailed content',
      metadata: {
        title: 'A Detail',
        description: 'Full page',
        sourceURL: 'https://a.com',
        url: 'https://a.com/page',
      },
    });

    mockGenerateText.mockImplementation(
      async (opts: { tools: Record<string, { execute: (args: Record<string, string>) => Promise<unknown> }> }) => {
        await opts.tools.webSearch.execute({ query: 'test' });
        await opts.tools.scrapeUrl.execute({ url: 'https://a.com' });
        return { text: '상세 정보 요약' };
      },
    );

    const result = await agenticSearch([{ key: 'topic', value: 'test' }]);

    expect(result.sources).toHaveLength(2);
    expect(result.sources.map((s) => s.url)).toContain('https://a.com/page');
  });

  it('gracefully degrades on generateText failure', async () => {
    mockFirecrawlSearch.mockResolvedValue([
      { url: 'https://a.com', title: 'A', description: 'D' },
    ]);

    mockGenerateText.mockImplementation(
      async (opts: { tools: Record<string, { execute: (args: Record<string, string>) => Promise<unknown> }> }) => {
        // Collect some results before failing
        await opts.tools.webSearch.execute({ query: 'test' });
        throw new Error('Model timeout');
      },
    );

    const result = await agenticSearch([{ key: 'topic', value: 'test' }]);

    // Should return partial results, not throw
    expect(result.summary).toBe('');
    expect(result.sources).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// formatAgenticResultsForPrompt
// ---------------------------------------------------------------------------

describe('formatAgenticResultsForPrompt', () => {
  it('returns empty string for empty result', () => {
    expect(formatAgenticResultsForPrompt({ summary: '', sources: [] })).toBe(
      '',
    );
  });

  it('formats summary and sources', () => {
    const formatted = formatAgenticResultsForPrompt({
      summary: '핵심 요약 내용',
      sources: [
        { url: 'https://a.com', title: 'Source A', description: 'Desc A' },
        { url: 'https://b.com', title: 'Source B', description: 'Desc B' },
      ],
    });

    expect(formatted).toContain('[웹 리서치 결과]');
    expect(formatted).toContain('핵심 요약 내용');
    expect(formatted).toContain('[참고 출처]');
    expect(formatted).toContain('[1] Source A');
    expect(formatted).toContain('[2] Source B');
    expect(formatted).toContain('출처: https://a.com');
  });

  it('handles result with summary but no sources', () => {
    const formatted = formatAgenticResultsForPrompt({
      summary: '요약만 있는 경우',
      sources: [],
    });
    expect(formatted).toContain('요약만 있는 경우');
    expect(formatted).not.toContain('[참고 출처]');
  });
});

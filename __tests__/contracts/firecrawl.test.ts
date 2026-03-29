import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// We test the firecrawl module's request schemas, truncation, and graceful
// skip behaviour. No real API calls — we mock global fetch.
// ---------------------------------------------------------------------------

import {
  firecrawlSearch,
  firecrawlScrape,
  truncate,
  buildSearchQuery,
  formatSearchResultsForPrompt,
  type SearchResult,
} from '@/ai/firecrawl';

// ---------------------------------------------------------------------------
// Setup: capture fetch calls
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubEnv('FIRECRAWL_API_KEY', 'test-key-123');
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// firecrawlSearch — request schema contracts
// ---------------------------------------------------------------------------

describe('firecrawlSearch (contract tests)', () => {
  it('sends correct request body with query and limit', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    await firecrawlSearch('서울 여행');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

    // URL contract
    expect(url).toBe('https://api.firecrawl.dev/v1/search');

    // Method contract
    expect(options.method).toBe('POST');

    // Headers contract
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key-123');
    expect(headers['Content-Type']).toBe('application/json');

    // Body schema contract: { query, limit }
    const body = JSON.parse(options.body as string) as { query: string; limit: number };
    expect(body).toEqual({ query: '서울 여행', limit: 5 });
  });

  it('returns full results without truncation', async () => {
    const longDesc = 'A'.repeat(400);
    const longTitle = 'B'.repeat(500);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { url: 'https://example.com', title: longTitle, description: longDesc },
        ],
      }),
    });

    const results = await firecrawlSearch('test');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe(longTitle);
    expect(results[0].description).toBe(longDesc);
  });

  it('returns max 5 results even if API returns more', async () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      url: `https://example.com/${i}`,
      title: `Result ${i}`,
      description: `Desc ${i}`,
    }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items }),
    });

    const results = await firecrawlSearch('test');
    expect(results).toHaveLength(5);
  });

  it('returns empty array when FIRECRAWL_API_KEY is missing', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', '');
    // Also clear any cached value
    delete process.env.FIRECRAWL_API_KEY;

    const results = await firecrawlSearch('test');
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array on HTTP error (e.g. 429 rate limit)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
    });

    const results = await firecrawlSearch('test');
    expect(results).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const results = await firecrawlSearch('test');
    expect(results).toEqual([]);
  });

  it('returns empty array when API returns success: false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Invalid query' }),
    });

    const results = await firecrawlSearch('test');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// firecrawlScrape — request schema contracts
// ---------------------------------------------------------------------------

describe('firecrawlScrape (contract tests)', () => {
  it('sends correct request body with url and formats', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          markdown: '# Hello',
          metadata: {
            title: 'Test',
            description: 'A page',
            sourceURL: 'https://example.com',
            url: 'https://example.com',
          },
        },
      }),
    });

    await firecrawlScrape('https://example.com');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

    // URL contract
    expect(url).toBe('https://api.firecrawl.dev/v1/scrape');

    // Method contract
    expect(options.method).toBe('POST');

    // Headers contract
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key-123');
    expect(headers['Content-Type']).toBe('application/json');

    // Body schema contract: { url, formats }
    const body = JSON.parse(options.body as string) as { url: string; formats: string[] };
    expect(body).toEqual({
      url: 'https://example.com',
      formats: ['markdown'],
    });
  });

  it('returns parsed scrape result', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          markdown: '# Hello World',
          metadata: {
            title: 'Hello',
            description: 'World',
            sourceURL: 'https://example.com',
            url: 'https://example.com/page',
          },
        },
      }),
    });

    const result = await firecrawlScrape('https://example.com');
    expect(result).not.toBeNull();
    expect(result!.markdown).toBe('# Hello World');
    expect(result!.metadata.title).toBe('Hello');
    expect(result!.metadata.sourceURL).toBe('https://example.com');
  });

  it('returns null when FIRECRAWL_API_KEY is missing', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', '');
    delete process.env.FIRECRAWL_API_KEY;

    const result = await firecrawlScrape('https://example.com');
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await firecrawlScrape('https://example.com');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const result = await firecrawlScrape('https://example.com');
    expect(result).toBeNull();
  });

  it('returns null when API returns success: false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Payment required' }),
    });

    const result = await firecrawlScrape('https://example.com');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// truncate helper
// ---------------------------------------------------------------------------

describe('truncate', () => {
  it('returns original if within limit', () => {
    expect(truncate('hello', 300)).toBe('hello');
  });

  it('truncates and adds ... when exceeding limit', () => {
    const long = 'A'.repeat(350);
    const result = truncate(long, 300);
    expect(result.length).toBe(300);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles exact boundary', () => {
    const exact = 'A'.repeat(300);
    expect(truncate(exact, 300)).toBe(exact);
  });
});

// ---------------------------------------------------------------------------
// buildSearchQuery helper
// ---------------------------------------------------------------------------

describe('buildSearchQuery', () => {
  it('combines user message and recent context values', () => {
    const contexts = [
      { key: 'destination', value: '도쿄' },
      { key: 'duration', value: '3박 4일' },
    ];
    const query = buildSearchQuery(contexts, '여행 계획 도와주세요');
    expect(query).toContain('여행 계획 도와주세요');
    expect(query).toContain('도쿄');
    expect(query).toContain('3박 4일');
  });

  it('works without user message', () => {
    const contexts = [{ key: 'topic', value: '사업계획서' }];
    const query = buildSearchQuery(contexts);
    expect(query).toContain('사업계획서');
  });

  it('limits total query length to 200 chars', () => {
    const contexts = [
      { key: 'a', value: 'A'.repeat(100) },
      { key: 'b', value: 'B'.repeat(100) },
      { key: 'c', value: 'C'.repeat(100) },
    ];
    const query = buildSearchQuery(contexts, 'X'.repeat(100));
    expect(query.length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// formatSearchResultsForPrompt helper
// ---------------------------------------------------------------------------

describe('formatSearchResultsForPrompt', () => {
  it('returns empty string for empty results', () => {
    expect(formatSearchResultsForPrompt([])).toBe('');
  });

  it('formats results with numbered entries', () => {
    const results: SearchResult[] = [
      { url: 'https://a.com', title: 'Title A', description: 'Desc A' },
      { url: 'https://b.com', title: 'Title B', description: 'Desc B' },
    ];
    const formatted = formatSearchResultsForPrompt(results);
    expect(formatted).toContain('[웹 검색 참고 자료]');
    expect(formatted).toContain('[1] Title A');
    expect(formatted).toContain('[2] Title B');
    expect(formatted).toContain('출처: https://a.com');
  });
});

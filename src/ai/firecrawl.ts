// ---------------------------------------------------------------------------
// Firecrawl Web Search / Scrape Client
// ---------------------------------------------------------------------------
// REST API direct calls (no SDK). Graceful skip on missing key or errors.

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  url: string;
  title: string;
  description: string;
}

export interface ScrapeResult {
  markdown: string;
  metadata: {
    title: string;
    description: string;
    sourceURL: string;
    url: string;
  };
}

// ---------------------------------------------------------------------------
// Internal: Firecrawl API raw response shapes
// ---------------------------------------------------------------------------

interface FirecrawlSearchResponseItem {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
}

interface FirecrawlSearchResponse {
  success?: boolean;
  data?: FirecrawlSearchResponseItem[];
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      url?: string;
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string | null {
  return process.env.FIRECRAWL_API_KEY ?? null;
}

/** Truncate text to maxLen characters, appending "..." if truncated */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

// ---------------------------------------------------------------------------
// firecrawlSearch
// ---------------------------------------------------------------------------

export async function firecrawlSearch(
  query: string,
): Promise<SearchResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const res = await fetch(`${FIRECRAWL_BASE}/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (!res.ok) return [];

    const json = (await res.json()) as FirecrawlSearchResponse;
    if (!json.success || !Array.isArray(json.data)) return [];

    return json.data.slice(0, 5).map((item) => ({
      url: item.url ?? '',
      title: truncate(item.title ?? '', 300),
      description: truncate(item.description ?? item.markdown ?? '', 300),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// firecrawlScrape
// ---------------------------------------------------------------------------

export async function firecrawlScrape(
  url: string,
): Promise<ScrapeResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['markdown'] }),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as FirecrawlScrapeResponse;
    if (!json.success || !json.data) return null;

    return {
      markdown: json.data.markdown ?? '',
      metadata: {
        title: json.data.metadata?.title ?? '',
        description: json.data.metadata?.description ?? '',
        sourceURL: json.data.metadata?.sourceURL ?? '',
        url: json.data.metadata?.url ?? '',
      },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// buildSearchQuery — helper for Collect/Simulate integration
// ---------------------------------------------------------------------------

export function buildSearchQuery(
  contexts: { key: string; value: string }[],
  userMessage?: string,
): string {
  const parts: string[] = [];

  if (userMessage) {
    parts.push(userMessage);
  }

  // Pick up to 3 most recent context values for search
  const recentValues = contexts
    .slice(-3)
    .map((c) => c.value)
    .filter((v) => v.length > 0);

  parts.push(...recentValues);

  return parts.join(' ').slice(0, 200);
}

// ---------------------------------------------------------------------------
// formatSearchResultsForPrompt
// ---------------------------------------------------------------------------

export function formatSearchResultsForPrompt(
  results: SearchResult[],
): string {
  if (results.length === 0) return '';

  const lines = results.map(
    (r, i) =>
      `[${i + 1}] ${r.title}\n${r.description}\n출처: ${r.url}`,
  );

  return `\n\n[웹 검색 참고 자료]\n${lines.join('\n\n')}`;
}

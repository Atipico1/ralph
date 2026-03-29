// ---------------------------------------------------------------------------
// Agentic Web Search — ReAct loop: search → reflect → search → ...
// ---------------------------------------------------------------------------
// Uses AI SDK generateText + tool calls so the LLM decides what to search,
// reflects on results, and iterates until it has enough information.

import { generateText, tool } from 'ai';
import { z } from 'zod';
import { mainAgentModel } from '@/ai/providers';
import {
  firecrawlSearch,
  firecrawlScrape,
  type SearchResult,
} from '@/ai/firecrawl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgenticSearchResult {
  /** LLM-synthesized summary of all findings */
  summary: string;
  /** All unique sources collected during the search loop */
  sources: SearchResult[];
}

// ---------------------------------------------------------------------------
// agenticSearch
// ---------------------------------------------------------------------------

export async function agenticSearch(
  contexts: { key: string; value: string }[],
  userMessage?: string,
): Promise<AgenticSearchResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { summary: '', sources: [] };

  const collectedSources: SearchResult[] = [];

  const contextText = contexts.map((c) => `- ${c.key}: ${c.value}`).join('\n');
  const userNote = userMessage ? `\n사용자 메시지: ${userMessage}` : '';

  try {
    const { text } = await generateText({
      model: mainAgentModel(),
      tools: {
        webSearch: tool({
          description:
            '웹에서 정보를 검색합니다. 다양한 검색어로 여러 번 호출할 수 있습니다.',
          parameters: z.object({
            query: z
              .string()
              .describe('검색 쿼리 (구체적이고 명확하게)'),
          }),
          execute: async ({ query }) => {
            const results = await firecrawlSearch(query);
            collectedSources.push(...results);
            return results.map((r) => ({
              title: r.title,
              description: r.description,
              url: r.url,
            }));
          },
        }),
        scrapeUrl: tool({
          description:
            '특정 URL의 전체 내용을 가져옵니다. 검색 결과에서 더 자세한 정보가 필요할 때 사용합니다.',
          parameters: z.object({
            url: z.string().describe('스크랩할 URL'),
          }),
          execute: async ({ url }) => {
            const result = await firecrawlScrape(url);
            if (!result) return { error: 'Failed to scrape URL' };
            collectedSources.push({
              url: result.metadata.url || url,
              title: result.metadata.title,
              description: result.markdown,
            });
            return {
              title: result.metadata.title,
              content: result.markdown,
            };
          },
        }),
      },
      maxSteps: 2,
      system: `당신은 웹 리서치 에이전트입니다. 주어진 맥락에 대해 유용한 정보를 웹에서 찾아 정리합니다.

[규칙]
- webSearch 도구로 관련 정보를 검색하세요.
- 검색 결과가 부족하거나 다른 관점이 필요하면 다른 검색어로 다시 검색하세요.
- 중요한 검색 결과가 있으면 scrapeUrl로 상세 내용을 가져오세요.
- 충분한 정보를 모았으면 한국어로 핵심 내용을 정리해서 응답하세요.
- 최소 1회 검색을 수행하세요.
- 검색어는 한국어와 영어를 적절히 섞어 사용하세요.`,
      prompt: `다음 맥락에 대해 웹에서 유용한 정보를 찾아주세요:

수집된 컨텍스트:
${contextText}${userNote}`,
    });

    const uniqueSources = deduplicateByUrl(collectedSources);

    return { summary: text, sources: uniqueSources };
  } catch {
    // Graceful degradation — return whatever was collected before failure
    return {
      summary: '',
      sources: deduplicateByUrl(collectedSources),
    };
  }
}

// ---------------------------------------------------------------------------
// formatAgenticResultsForPrompt
// ---------------------------------------------------------------------------

export function formatAgenticResultsForPrompt(
  result: AgenticSearchResult,
): string {
  if (!result.summary && result.sources.length === 0) return '';

  const parts: string[] = ['\n\n[웹 리서치 결과]'];

  if (result.summary) {
    parts.push(result.summary);
  }

  if (result.sources.length > 0) {
    parts.push('[참고 출처]');
    result.sources.forEach((s, i) => {
      parts.push(`[${i + 1}] ${s.title}\n출처: ${s.url}`);
    });
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deduplicateByUrl(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

import { describe, it, expect } from 'vitest';
import { loadEnvConfig } from '@next/env';

// Load .env.local for real API keys
loadEnvConfig(process.cwd());

const skip = !process.env.FIRECRAWL_API_KEY;

describe.skipIf(skip)('Firecrawl Smoke Tests', () => {
  it(
    'firecrawlSearch("서울 여행") returns results array',
    async () => {
      // Dynamic import to ensure env is loaded before module reads it
      const { firecrawlSearch } = await import('@/ai/firecrawl');

      const results = await firecrawlSearch('서울 여행');

      // Results should be an array (may be empty if rate-limited, but must be array)
      expect(Array.isArray(results)).toBe(true);

      // If results exist, verify structure
      if (results.length > 0) {
        const first = results[0];
        expect(first).toHaveProperty('url');
        expect(first).toHaveProperty('title');
        expect(first).toHaveProperty('description');
        // Verify 300 char truncation
        expect(first.description.length).toBeLessThanOrEqual(300);
        expect(first.title.length).toBeLessThanOrEqual(300);
      }

      // Max 5 results
      expect(results.length).toBeLessThanOrEqual(5);
    },
    30000,
  );
});

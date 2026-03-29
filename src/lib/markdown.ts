import { marked } from 'marked';

// Configure marked once, centrally
marked.setOptions({ breaks: true, gfm: true });

export function parseMarkdown(content: string): string {
  return marked.parse(content) as string;
}

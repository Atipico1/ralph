// ── SSE Frame Parser ─────────────────────────────────────────────────────────
// Shared between useCollect and useSimulate hooks.

export interface SSEFrame {
  event: string;
  data: string;
}

export function parseSSEFrames(raw: string): { frames: SSEFrame[]; remainder: string } {
  const frames: SSEFrame[] = [];
  // Split by double newline (SSE frame delimiter)
  const parts = raw.split('\n\n');
  // Last part may be incomplete
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let event = '';
    let data = '';

    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event: ')) {
        event = line.slice(7);
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }

    if (event && data) {
      frames.push({ event, data });
    }
  }

  return { frames, remainder };
}

'use client';

// ── Props ───────────────────────────────────────────────────────────────────

interface RationaleListProps {
  rationale: string;
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Displays rationale text as a bullet list.
 * If the rationale contains newlines, each line becomes a bullet.
 * Otherwise, it is shown as a single bullet.
 */
export default function RationaleList({ rationale }: RationaleListProps) {
  // Split into bullets: by newlines, removing empty/whitespace-only lines
  const bullets = rationale
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);

  if (bullets.length === 0) return null;

  return (
    <section className="w-full">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        왜 이게 좋은지:
      </h3>
      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li
            key={`rationale-${i}`}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-600"
          >
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

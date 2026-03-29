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
      <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50/80 p-5 md:p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-zinc-400">
          추천 이유
        </h3>
        <ul className="space-y-3">
          {bullets.map((bullet, i) => (
            <li
              key={`rationale-${i}`}
              className="flex items-start gap-3 text-[15px] leading-relaxed text-gray-600"
            >
              <span className="mt-[7px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                {i + 1}
              </span>
              <span className="pt-[1px]">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

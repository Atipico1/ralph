'use client';

import { useState } from 'react';

interface ClipboardPanelProps {
  contexts: Array<{ key: string; value: string }>;
}

export default function ClipboardPanel({ contexts }: ClipboardPanelProps) {
  return (
    <>
      {/* Desktop: fixed right panel */}
      <DesktopPanel contexts={contexts} />
      {/* Mobile: bottom sheet */}
      <MobileBottomSheet contexts={contexts} />
    </>
  );
}

// ── Desktop Panel ────────────────────────────────────────────────────────────

function DesktopPanel({
  contexts,
}: {
  contexts: Array<{ key: string; value: string }>;
}) {
  return (
    <aside className="hidden md:flex md:w-[320px] md:shrink-0 md:flex-col md:border-l md:border-border-subtle md:bg-surface-secondary/50 md:p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100">
          <svg className="h-4 w-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-text-primary">
          지금까지 파악한 것
        </h3>
        {contexts.length > 0 && (
          <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
            {contexts.length}
          </span>
        )}
      </div>

      {contexts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-tertiary">
            <svg className="h-6 w-6 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm leading-relaxed text-text-tertiary">
            아직 수집된 정보가 없어요.<br />
            질문에 답변하시면 여기에 정리됩니다.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {contexts.map((ctx, i) => (
            <li
              key={`${ctx.key}-${i}`}
              className="rounded-xl bg-surface-primary p-3.5 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-3 w-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-text-primary">{ctx.key}</span>
              </div>
              <p className="pl-7 text-sm leading-relaxed text-text-secondary">{ctx.value}</p>
            </li>
          ))}
        </ul>
      )}

      {contexts.length > 0 && (
        <p className="mt-auto pt-6 text-xs text-text-tertiary">
          나머지는 제가 알아볼게요
        </p>
      )}
    </aside>
  );
}

// ── Mobile Bottom Sheet ──────────────────────────────────────────────────────

function MobileBottomSheet({
  contexts,
}: {
  contexts: Array<{ key: string; value: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed right-0 bottom-0 left-0 z-50 rounded-t-3xl bg-surface-primary shadow-[0_-8px_32px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3.5rem)]'
        }`}
      >
        {/* Handle bar / collapsed state */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-center gap-2.5 px-4 py-3.5"
        >
          <div className="h-1 w-10 rounded-full bg-border-default" />
          <div className="ml-1 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-semibold text-text-primary">
              파악한 정보
            </span>
            {contexts.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-700">
                {contexts.length}
              </span>
            )}
          </div>
        </button>

        {/* Expanded content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-8">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            지금까지 파악한 것
          </h3>

          {contexts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-text-tertiary">
                아직 수집된 정보가 없어요.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {contexts.map((ctx, i) => (
                <li
                  key={`${ctx.key}-${i}`}
                  className="rounded-xl bg-surface-secondary p-3.5"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50">
                      <svg className="h-3 w-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-text-primary">{ctx.key}</span>
                  </div>
                  <p className="pl-7 text-sm leading-relaxed text-text-secondary">{ctx.value}</p>
                </li>
              ))}
            </ul>
          )}

          {contexts.length > 0 && (
            <p className="mt-5 text-xs text-text-tertiary">
              나머지는 제가 알아볼게요
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

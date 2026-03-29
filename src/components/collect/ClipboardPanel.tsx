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
    <aside className="hidden md:flex md:w-[300px] md:shrink-0 md:flex-col md:border-l md:border-gray-100 md:bg-gray-50/50 md:p-6">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">
        지금까지 파악한 것
      </h3>

      {contexts.length === 0 ? (
        <p className="text-sm text-gray-400">
          아직 수집된 정보가 없어요. 질문에 답변하시면 여기에 정리됩니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {contexts.map((ctx, i) => (
            <li key={`${ctx.key}-${i}`} className="text-sm text-gray-600">
              <span className="mr-1.5 text-green-500">✓</span>
              <span className="font-medium text-gray-700">{ctx.key}:</span>{' '}
              {ctx.value}
            </li>
          ))}
        </ul>
      )}

      {contexts.length > 0 && (
        <p className="mt-auto pt-6 text-xs text-gray-400">
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
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed right-0 bottom-0 left-0 z-50 rounded-t-2xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'
        }`}
      >
        {/* Handle bar / collapsed state */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-center gap-2 px-4 py-3"
        >
          <div className="h-1 w-8 rounded-full bg-gray-300" />
          <span className="ml-2 text-sm font-medium text-gray-600">
            파악한 정보 {contexts.length}개
          </span>
        </button>

        {/* Expanded content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            지금까지 파악한 것
          </h3>

          {contexts.length === 0 ? (
            <p className="text-sm text-gray-400">
              아직 수집된 정보가 없어요.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {contexts.map((ctx, i) => (
                <li key={`${ctx.key}-${i}`} className="text-sm text-gray-600">
                  <span className="mr-1.5 text-green-500">✓</span>
                  <span className="font-medium text-gray-700">{ctx.key}:</span>{' '}
                  {ctx.value}
                </li>
              ))}
            </ul>
          )}

          {contexts.length > 0 && (
            <p className="mt-4 text-xs text-gray-400">
              나머지는 제가 알아볼게요
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

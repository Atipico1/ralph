'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectChip {
  id: string;
  title: string;
  createdAt: string;
}

interface CreateProjectResponse {
  projectId: string;
  firstMessage: {
    id: string;
    content: string;
    inputType: string;
    options: string[] | null;
  };
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const SUGGESTIONS = [
  '자기소개서를 써주세요',
  '사업계획서를 작성해주세요',
  '도쿄 3박 4일 여행 계획을 세워주세요',
];

export default function LandingPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [recentProjects, setRecentProjects] = useState<ProjectChip[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data: ProjectChip[] = await res.json();
      setRecentProjects(data.slice(0, 10));
    } catch {
      // Silently ignore — recent projects are non-critical
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '요청에 실패했습니다.' }));
        throw new Error(
          (body as { error?: string }).error ?? '요청에 실패했습니다.',
        );
      }

      const data: CreateProjectResponse = await res.json();
      router.push(`/project/${data.projectId}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSuggestionClick(text: string) {
    setInput(text);
  }

  return (
    <>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-zinc-100 bg-white shadow-2xl shadow-zinc-900/[0.06] transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-zinc-400">History</h2>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="사이드바 닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {recentProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-2 py-16">
              <p className="text-[13px] text-zinc-300">
                아직 프로젝트가 없습니다
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {recentProjects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/project/${project.id}`)}
                    className="group w-full cursor-pointer rounded-lg px-3 py-2.5 text-left transition-all duration-150 hover:bg-zinc-50"
                  >
                    <span className="line-clamp-1 text-[13px] leading-snug text-zinc-600 group-hover:text-zinc-900">{project.title}</span>
                    <span className="mt-0.5 block text-[11px] text-zinc-300">{timeAgo(project.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex min-h-screen flex-col items-center justify-center px-4">
        {/* Background - grid pattern with radial fade */}
        <div className="pointer-events-none absolute inset-0 bg-white" />
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid-fade" />
        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute left-1/2 top-[35%] h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-zinc-100/80 via-transparent to-zinc-200/40 blur-3xl" />

        {/* History button (top-left) */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-5 top-5 z-30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-zinc-300 transition-all duration-200 hover:text-zinc-600"
          aria-label="이전 프로젝트 열기"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Content */}
        <div className="relative z-10 w-full max-w-[640px] animate-fade-in-up">
          {/* Title - typographic, gradient */}
          <h1 className="text-gradient-title mb-1 text-center text-[36px] font-extrabold leading-[1.1] tracking-[-0.04em] sm:text-[48px]">
            ALJALDAKKALSEN
          </h1>
          <p className="mb-12 text-center text-[15px] font-medium tracking-wide text-zinc-400">
            무엇을 도와드릴까요?
          </p>

          {/* Input area - textarea with inline send button */}
          <form onSubmit={handleSubmit}>
            <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="원하시는 것을 자유롭게 설명해주세요..."
                rows={3}
                disabled={isSubmitting}
                className="w-full resize-none rounded-2xl bg-transparent px-5 pb-14 pt-4 text-[16px] leading-relaxed text-zinc-900 placeholder-zinc-300 focus:outline-none disabled:opacity-50"
              />
              <div className="absolute bottom-3 right-3">
                <button
                  type="submit"
                  disabled={isSubmitting || !input.trim()}
                  className="group flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-900 text-white transition-all duration-200 hover:bg-zinc-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100"
                  aria-label="전송"
                >
                  {isSubmitting ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3" role="alert">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}
          </form>

          {/* Suggestions */}
          <div className="mt-10 space-y-4 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            <p className="text-center text-[12px] font-medium uppercase tracking-[0.15em] text-zinc-300">
              이런 것도 할 수 있어요
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => handleSuggestionClick(text)}
                  className="cursor-pointer rounded-full border border-zinc-150 bg-white px-4 py-2 text-[13px] font-medium text-zinc-500 transition-all duration-200 hover:border-zinc-300 hover:text-zinc-900 active:scale-[0.97]"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

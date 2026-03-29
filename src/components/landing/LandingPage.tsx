'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectChip {
  id: string;
  title: string;
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

export default function LandingPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [recentProjects, setRecentProjects] = useState<ProjectChip[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data: ProjectChip[] = await res.json();
      setRecentProjects(data.slice(0, 5));
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8 text-center">
        {/* Greeting */}
        <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl">
          안녕하세요! 무엇을 도와드릴까요?
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="원하시는 것을 설명해주세요..."
            rows={4}
            disabled={isSubmitting}
            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
          />

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !input.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '처리 중...' : '시작하기'}
          </button>
        </form>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">최근 프로젝트</p>
            <div className="flex flex-wrap justify-center gap-2">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm text-gray-700 transition hover:border-gray-300 hover:bg-gray-100"
                >
                  {project.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-bold">Project: {id}</h1>
      <p className="mt-4 text-gray-600">이 페이지는 곧 구현될 예정입니다.</p>
    </main>
  );
}

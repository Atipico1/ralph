import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ALJALDAKKALSEN',
  description: 'ALJALDAKKALSEN - AI Agent Simulation Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="scroll-smooth">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen bg-white font-pretendard text-zinc-900 antialiased selection:bg-zinc-200 selection:text-zinc-900">
        {children}
      </body>
    </html>
  )
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Space Invaders Coop',
  description: 'Cooperative Space Invaders game',
}

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, paddingBottom: '2rem' }}>
        {children}
        <footer
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#555',
            fontSize: '0.75rem',
            fontFamily: 'JetBrains Mono, monospace',
            padding: '0.5rem',
          }}
        >
          {appVersion}
        </footer>
      </body>
    </html>
  )
}


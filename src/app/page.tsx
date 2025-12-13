import Link from 'next/link'

export default function Home() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        color: '#e0e0e0',
      }}
    >
      <h1
        style={{
          fontSize: '2rem',
          color: '#00ff88',
          textTransform: 'uppercase',
          letterSpacing: '0.3em',
          textShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
          marginBottom: '2rem',
        }}
      >
        Space Invaders
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Cooperative 2-player game
      </p>
      <Link
        href="/play"
        style={{
          padding: '1rem 2rem',
          background: 'transparent',
          border: '2px solid #00ff88',
          color: '#00ff88',
          fontSize: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        Play
      </Link>
    </div>
  )
}


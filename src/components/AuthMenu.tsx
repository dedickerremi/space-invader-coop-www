'use client'

import { SignInButton, UserButton, useAuth } from '@clerk/nextjs'

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export function AuthMenu() {
  if (!hasClerk) return null
  return <AuthMenuInner />
}

function AuthMenuInner() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return null

  return (
    <div style={wrapperStyle}>
      {isSignedIn ? (
        <UserButton />
      ) : (
        <SignInButton mode="modal">
          <button style={signInButtonStyle}>Sign in</button>
        </SignInButton>
      )}
    </div>
  )
}

const wrapperStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1rem',
  right: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
}

const signInButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  background: 'transparent',
  border: '1px solid #00ff88',
  color: '#00ff88',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  cursor: 'pointer',
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
}

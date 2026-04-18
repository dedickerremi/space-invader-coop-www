'use client'

import { SignInButton, useAuth } from '@clerk/nextjs'

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

/** Small "sign in to save your scores" nudge. Hidden when Clerk isn't configured or the user is signed in. */
export function SignInHint() {
  if (!hasClerk) return null
  return <SignInHintInner />
}

function SignInHintInner() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded || isSignedIn) return null

  return (
    <div style={hintStyle}>
      <SignInButton mode="modal">
        <button style={linkStyle}>Sign in</button>
      </SignInButton>
      <span> to save your scores</span>
    </div>
  )
}

const hintStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  fontSize: '0.75rem',
  color: '#888',
  textAlign: 'center',
}

const linkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#00ff88',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  padding: 0,
  textDecoration: 'underline',
}

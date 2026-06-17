'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, Loader2, LogIn, Trophy } from 'lucide-react'
import { getSession, saveSession } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [yourName, setYourName] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return
      setSignedIn(Boolean(user))
      setCheckingAuth(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user))
      setCheckingAuth(false)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (checkingAuth || signedIn) return
    const existing = getSession(code)
    if (existing) router.replace(`/league/${code}`)
  }, [checkingAuth, code, router, signedIn])

  const handleJoin = async () => {
    if (!signedIn) {
      router.push(`/auth/sign-in?next=/join/${code}`)
      return
    }
    if (!yourName.trim()) return

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code, display_name: yourName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      saveSession(data.league.invite_code, data.session)
      router.push(`/league/${data.league.invite_code}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || checkingAuth || (signedIn && yourName.trim().length < 2)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-7">
          <div className="inline-flex w-12 h-12 rounded-lg items-center justify-center mb-3"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
            <Trophy size={22} />
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>Join League</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Invite code:{' '}
            <span className="font-mono font-bold tracking-widest" style={{ color: 'var(--accent)' }}>{code}</span>
          </p>
        </div>

        <div className="rounded-lg p-5 flex flex-col gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {!checkingAuth && !signedIn && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              Sign in first so this league is saved to your account.
            </p>
          )}

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Your display name
            </label>
            <input
              type="text"
              placeholder="How you'll appear on the board"
              value={yourName}
              onChange={e => setYourName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={20}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg)',
                border: '1.5px solid var(--border)',
                color: 'var(--text)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
            <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
              Use an existing name to claim that old player slot for your account.
            </p>
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <button
            onClick={handleJoin}
            disabled={disabled}
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            style={{
              background: disabled ? 'var(--surface-2)' : 'var(--accent)',
              color: disabled ? 'var(--text-subtle)' : '#000',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading || checkingAuth ? <Loader2 size={14} className="animate-spin" /> : signedIn ? <ArrowRight size={14} /> : <LogIn size={14} />}
            {checkingAuth ? 'Checking...' : loading ? 'Joining...' : signedIn ? 'Join League' : 'Sign in to join'}
          </button>

          <button onClick={() => router.push('/')} className="text-xs text-center"
            style={{ color: 'var(--text-subtle)' }}>
            Back to home
          </button>
        </div>
      </div>
    </main>
  )
}

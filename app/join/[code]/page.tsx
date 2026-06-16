'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { saveSession, getSession } from '@/lib/utils'

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [yourName, setYourName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Already in this league → go straight in
  useEffect(() => {
    const existing = getSession(code)
    if (existing) router.replace(`/league/${code}`)
  }, [code, router])

  const handleJoin = async () => {
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
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-7">
          <div className="text-4xl mb-3">⚽</div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>Join League</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Invite code:{' '}
            <span className="font-mono font-bold tracking-widest" style={{ color: 'var(--accent)' }}>{code}</span>
          </p>
        </div>

        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
                background: 'var(--bg)', border: '1.5px solid var(--border)',
                color: 'var(--text)', transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
            <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
              💡 Tip: Use the same name to recover your picks on another device or browser.
            </p>
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <button
            onClick={handleJoin}
            disabled={yourName.trim().length < 2 || loading}
            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{
              background: yourName.trim().length < 2 ? 'var(--surface-2)' : 'var(--accent)',
              color: yourName.trim().length < 2 ? 'var(--text-subtle)' : '#000',
              cursor: yourName.trim().length < 2 || loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            {loading ? 'Joining…' : 'Join League'}
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

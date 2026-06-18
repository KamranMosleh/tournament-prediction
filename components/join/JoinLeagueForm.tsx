'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Trophy } from 'lucide-react'

export function JoinLeagueForm({ code, leagueName, archived }: { code: string; leagueName: string; archived: boolean }) {
  const router = useRouter()
  const [yourName, setYourName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    if (archived || yourName.trim().length < 2) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code, display_name: yourName }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Failed to join league')
      router.push(`/league/${data.league.invite_code}`)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const disabled = archived || loading || yourName.trim().length < 2

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xs">
        <div className="text-center mb-7">
          <div className="inline-flex w-12 h-12 rounded-lg items-center justify-center mb-3" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
            <Trophy size={22} />
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>{leagueName}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Invite code: <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{code}</span>
          </p>
        </div>
        <div className="rounded-lg p-5 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {archived ? (
            <p className="text-sm text-center" style={{ color: 'var(--gold)' }}>This league is archived and is not accepting new members.</p>
          ) : (
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Your display name</label>
              <input
                type="text"
                placeholder="How you'll appear on the board"
                value={yourName}
                onChange={event => setYourName(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && handleJoin()}
                maxLength={20}
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
          )}
          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
          {!archived && (
            <button onClick={handleJoin} disabled={disabled} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: disabled ? 'var(--surface-2)' : 'var(--accent)', color: disabled ? 'var(--text-subtle)' : '#000' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {loading ? 'Joining...' : 'Join League'}
            </button>
          )}
          <button onClick={() => router.push('/')} className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>Back to home</button>
        </div>
      </div>
    </main>
  )
}

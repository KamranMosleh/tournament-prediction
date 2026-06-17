'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updatePassword = async () => {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Set new password</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Choose a new password for your account.</p>
        </div>
        <div className="rounded-lg p-5 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && updatePassword()}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
          <button
            onClick={updatePassword}
            disabled={password.length < 6 || loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            style={{
              background: password.length < 6 ? 'var(--surface-2)' : 'var(--accent)',
              color: password.length < 6 ? 'var(--text-subtle)' : '#000',
              cursor: password.length < 6 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {loading ? 'Saving...' : 'Save new password'}
          </button>
        </div>
      </div>
    </main>
  )
}

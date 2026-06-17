'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const sendReset = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    })
    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setMessage('Check your email for a password reset link.')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Reset password</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>We will send you a secure reset link.</p>
        </div>
        <div className="rounded-lg p-5 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendReset()}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
          {message && <p className="text-xs" style={{ color: 'var(--accent)' }}>{message}</p>}
          <button
            onClick={sendReset}
            disabled={!email.trim() || loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            style={{
              background: !email.trim() ? 'var(--surface-2)' : 'var(--accent)',
              color: !email.trim() ? 'var(--text-subtle)' : '#000',
              cursor: !email.trim() || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
          <Link href="/auth/sign-in" className="text-xs text-center" style={{ color: 'var(--blue)' }}>Back to sign in</Link>
        </div>
      </div>
    </main>
  )
}

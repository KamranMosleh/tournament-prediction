'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const nextPath = () => {
    if (typeof window === 'undefined') return '/'
    return new URLSearchParams(window.location.search).get('next') || '/'
  }

  const signIn = async () => {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.push(nextPath())
    router.refresh()
  }

  return (
    <AuthShell title="Sign in" subtitle="Use your account to access leagues on any device.">
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Password" type="password" value={password} onChange={setPassword} onEnter={signIn} />
      {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
      <button
        onClick={signIn}
        disabled={!email.trim() || !password || loading}
        className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
        style={{
          background: !email.trim() || !password ? 'var(--surface-2)' : 'var(--accent)',
          color: !email.trim() || !password ? 'var(--text-subtle)' : '#000',
          cursor: !email.trim() || !password || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      <div className="flex items-center justify-between text-xs">
        <Link href="/auth/sign-up" style={{ color: 'var(--blue)' }}>Create account</Link>
        <Link href="/auth/reset-password" style={{ color: 'var(--text-muted)' }}>Forgot password?</Link>
      </div>
    </AuthShell>
  )
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{title}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        </div>
        <div className="rounded-lg p-5 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {children}
          <Link href="/" className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>Back to home</Link>
        </div>
      </div>
    </main>
  )
}

function Field({ label, type, value, onChange, onEnter }: {
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
        style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
      />
    </div>
  )
}

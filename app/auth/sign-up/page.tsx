'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { getAuthEmailErrorMessage } from '@/lib/auth-error'
import { safeNextPath, withNext } from '@/lib/auth-redirect'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  return <Suspense><SignUpForm /></Suspense>
}

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const next = safeNextPath(searchParams.get('next'))

  const signUp = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    const origin = window.location.origin
    const { data, error: signUpError } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    setLoading(false)

    if (signUpError) return setError(getAuthEmailErrorMessage(signUpError, 'sign-up'))
    if (data.session) {
      router.push(next)
      router.refresh()
      return
    }
    setMessage('Check your email to confirm your account. The confirmation link will return you to your destination.')
  }

  return (
    <AuthShell title="Create account" subtitle="Create one account for all your private leagues." next={next}>
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Password" type="password" value={password} onChange={setPassword} onEnter={signUp} />
      {error && <p role="alert" className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
      {message && <p role="status" className="text-xs" style={{ color: 'var(--accent)' }}>{message}</p>}
      <button onClick={signUp} disabled={!email.trim() || password.length < 6 || loading} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: !email.trim() || password.length < 6 ? 'var(--surface-2)' : 'var(--accent)', color: !email.trim() || password.length < 6 ? 'var(--text-subtle)' : '#000' }}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
        {loading ? 'Creating...' : 'Create account'}
      </button>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Passwords must be at least 6 characters.</p>
      <Link href={withNext('/auth/sign-in', next)} className="text-xs text-center" style={{ color: 'var(--blue)' }}>Already have an account?</Link>
    </AuthShell>
  )
}

function AuthShell({ title, subtitle, next, children }: { title: string; subtitle: string; next: string; children: React.ReactNode }) {
  const backToInvite = next.startsWith('/join/')
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{title}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        </div>
        <div className="rounded-lg p-5 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {children}
          <Link href={backToInvite ? next : '/'} className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
            {backToInvite ? 'Back to invitation' : 'Back to home'}
          </Link>
        </div>
      </div>
    </main>
  )
}

function Field({ label, type, value, onChange, onEnter }: { label: string; type: string; value: string; onChange: (value: string) => void; onEnter?: () => void }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => event.key === 'Enter' && onEnter?.()} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }} />
    </div>
  )
}

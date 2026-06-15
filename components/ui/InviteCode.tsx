'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  code: string
}

export function InviteCode({ code }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    const url = `${window.location.origin}/join/${code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Code</span>
        <span className="font-mono font-bold tracking-widest text-sm" style={{ color: 'var(--accent)' }}>
          {code}
        </span>
      </div>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: copied ? 'var(--accent-glow)' : 'var(--surface-2)',
          border: `1px solid ${copied ? 'var(--accent)' : 'var(--border)'}`,
          color: copied ? 'var(--accent)' : 'var(--text-muted)',
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied!' : 'Share link'}
      </button>
    </div>
  )
}

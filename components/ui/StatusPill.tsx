import type { MatchStatus } from '@/types'
import { Lock, Clock, CheckCircle } from 'lucide-react'

interface Props {
  status: MatchStatus
}

export function StatusPill({ status }: Props) {
  const configs = {
    open: { label: 'Open', icon: Clock, style: { color: 'var(--accent)', background: 'var(--accent-glow)', border: '1px solid rgba(63,185,80,0.3)' } },
    locked: { label: 'Live / Locked', icon: Lock, style: { color: 'var(--gold)', background: 'rgba(210,153,34,0.12)', border: '1px solid rgba(210,153,34,0.3)' } },
    finished: { label: 'Finished', icon: CheckCircle, style: { color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)' } },
  }
  const { label, icon: Icon, style } = configs[status]

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={style}>
      <Icon size={10} />
      {label}
    </span>
  )
}

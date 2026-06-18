'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Archive, Loader2, RotateCcw, Settings, Trash2, X } from 'lucide-react'
import type { League } from '@/types'

type Props = {
  league: League
}

export function LeagueLifecycleDialog({ league }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState<'archive' | 'restore' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const isArchived = Boolean(league.archived_at)

  const updateArchiveState = async (action: 'archive' | 'restore') => {
    setError('')
    setPending(action)
    try {
      const res = await fetch(`/api/leagues/${league.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Failed to ${action} league`)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError(`Failed to ${action} league`)
    } finally {
      setPending(null)
    }
  }

  const deleteLeague = async () => {
    setError('')
    setPending('delete')
    try {
      const res = await fetch(`/api/leagues/${league.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_invite_code: confirmation }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to permanently delete league')
        return
      }
      setOpen(false)
      router.replace('/')
      router.refresh()
    } catch {
      setError('Failed to permanently delete league')
    } finally {
      setPending(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={value => {
      if (pending) return
      setOpen(value)
      if (!value) {
        setConfirmation('')
        setError('')
      }
    }}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          title="League settings"
          aria-label="League settings"
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <Settings size={14} />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.72)' }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-md max-h-[85vh] overflow-y-auto rounded-lg p-5 outline-none"
          style={{
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <Dialog.Title className="font-semibold text-base" style={{ color: 'var(--text)' }}>
                League settings
              </Dialog.Title>
              <Dialog.Description className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Owner-only controls for {league.name}.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close" className="p-1" style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <section className="pb-5 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              {isArchived
                ? <RotateCcw size={15} style={{ color: 'var(--accent)' }} />
                : <Archive size={15} style={{ color: 'var(--gold)' }} />}
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {isArchived ? 'Restore league' : 'Archive league'}
              </h3>
            </div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
              {isArchived
                ? 'Restoring re-enables joining, predictions, result edits, imports, sync, and AI generation.'
                : 'Archiving keeps standings and history visible, but immediately blocks joining, predictions, result edits, imports, sync, and AI generation.'}
            </p>
            <button
              type="button"
              onClick={() => updateArchiveState(isArchived ? 'restore' : 'archive')}
              disabled={pending !== null}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: isArchived ? 'var(--accent)' : 'rgba(210,153,34,0.14)',
                color: isArchived ? '#000' : 'var(--gold)',
                border: isArchived ? '1px solid var(--accent)' : '1px solid rgba(210,153,34,0.35)',
                cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending === 'archive' || pending === 'restore'
                ? <Loader2 size={13} className="animate-spin" />
                : isArchived ? <RotateCcw size={13} /> : <Archive size={13} />}
              {isArchived ? 'Restore league' : 'Archive league'}
            </button>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} style={{ color: 'var(--red)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
                Permanently delete league
              </h3>
            </div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
              This permanently deletes league membership, match predictions, tournament picks, summaries, and recaps. This cannot be undone. Shared tournament fixtures and sync logs remain.
            </p>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Type invite code <span className="font-mono" style={{ color: 'var(--text)' }}>{league.invite_code}</span> to confirm
            </label>
            <input
              value={confirmation}
              onChange={e => setConfirmation(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded-lg text-sm font-mono uppercase outline-none mb-3"
              style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
            />
            <button
              type="button"
              onClick={deleteLeague}
              disabled={confirmation !== league.invite_code || pending !== null}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold"
              style={{
                background: confirmation === league.invite_code ? 'var(--red)' : 'var(--surface-2)',
                color: confirmation === league.invite_code ? '#fff' : 'var(--text-subtle)',
                border: '1px solid var(--border)',
                cursor: confirmation !== league.invite_code || pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending === 'delete' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Permanently delete league
            </button>
          </section>

          {error && (
            <p className="text-xs mt-4" style={{ color: 'var(--red)' }}>{error}</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

import { MatchCard } from './MatchCard'
import { stageLabel, stageOrder } from '@/lib/utils'
import type { MatchWithPrediction, MatchRecap, MatchRevealData, MatchStage } from '@/types'

interface Props {
  matches: MatchWithPrediction[]
  playerId: string
  recaps?: MatchRecap[]
  reveals?: Map<string, MatchRevealData>
  isAdmin?: boolean
  canImportFixtures?: boolean
  onImportFixtures?: () => void
  syncState?: 'idle' | 'syncing' | 'success' | 'error'
  syncMessage?: string | null
  readOnly?: boolean
}

export function MatchList({
  matches,
  playerId,
  recaps = [],
  reveals = new Map<string, MatchRevealData>(),
  isAdmin = false,
  canImportFixtures = false,
  onImportFixtures,
  syncState = 'idle',
  syncMessage = null,
  readOnly = false,
}: Props) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
        <div className="text-4xl mb-3">📅</div>
        <p className="font-medium">No matches yet</p>
        <p className="text-sm mt-1">The fixture list hasn't been added yet.</p>
        {isAdmin && canImportFixtures && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              onClick={onImportFixtures}
              disabled={!onImportFixtures || syncState === 'syncing'}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--accent)',
                color: '#000',
                opacity: syncState === 'syncing' ? 0.7 : 1,
                cursor: syncState === 'syncing' ? 'not-allowed' : 'pointer',
              }}
            >
              {syncState === 'syncing' ? 'Importing fixtures…' : 'Import Fixtures'}
            </button>
            {syncMessage && (
              <p
                className="text-xs"
                style={{ color: syncState === 'error' ? 'var(--red)' : 'var(--text-subtle)' }}
              >
                {syncMessage}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Build match-id → recap lookup for O(1) access in render
  const recapMap = new Map(recaps.map(r => [r.match_id, r]))

  // Group by stage
  const grouped = new Map<MatchStage, MatchWithPrediction[]>()
  for (const m of matches) {
    const arr = grouped.get(m.stage) ?? []
    arr.push(m)
    grouped.set(m.stage, arr)
  }

  const sortedStages = [...grouped.entries()].sort(
    ([a], [b]) => stageOrder(a) - stageOrder(b)
  )

  return (
    <div className="flex flex-col gap-8">
      {sortedStages.map(([stage, stageMatches]) => (
        <section key={stage}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-3"
            style={{ color: 'var(--text-muted)' }}>
            <span>{stageLabel(stage)}</span>
            <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-subtle)' }}>{stageMatches.length} matches</span>
          </h3>

          {/* Group sub-sections */}
          {stage === 'group'
            ? <GroupStageSection matches={stageMatches} playerId={playerId} recapMap={recapMap} revealMap={reveals} readOnly={readOnly} />
            : (
              <div className="flex flex-col gap-3">
                {stageMatches
                  .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
                  .map(m => (
                    <MatchCard key={m.id} match={m} playerId={playerId} recap={recapMap.get(m.id)} reveal={reveals.get(m.id)} readOnly={readOnly} />
                  ))}
              </div>
            )
          }
        </section>
      ))}
    </div>
  )
}

function GroupStageSection({
  matches,
  playerId,
  recapMap,
  revealMap,
  readOnly = false,
}: Props & { recapMap: Map<string, MatchRecap>; revealMap: Map<string, MatchRevealData> }) {
  const byGroup = new Map<string, MatchWithPrediction[]>()
  for (const m of matches) {
    const g = m.group_name ?? 'TBD'
    const arr = byGroup.get(g) ?? []
    arr.push(m)
    byGroup.set(g, arr)
  }

  const sortedGroups = [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="flex flex-col gap-6">
      {sortedGroups.map(([group, groupMatches]) => (
        <div key={group}>
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-subtle)' }}>
            Group {group}
          </p>
          <div className="flex flex-col gap-3">
            {groupMatches
              .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
              .map(m => (
                <MatchCard
                  key={m.id}
                  match={m}
                  playerId={playerId}
                  recap={recapMap.get(m.id)}
                  reveal={revealMap.get(m.id)}
                  readOnly={readOnly}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

import { MatchCard } from './MatchCard'
import { stageLabel, stageOrder } from '@/lib/utils'
import type { MatchWithPrediction, MatchStage } from '@/types'

interface Props {
  matches: MatchWithPrediction[]
  playerId: string
  sessionToken: string
}

export function MatchList({ matches, playerId, sessionToken }: Props) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
        <div className="text-4xl mb-3">📅</div>
        <p className="font-medium">No matches yet</p>
        <p className="text-sm mt-1">The fixture list hasn't been added yet.</p>
      </div>
    )
  }

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
            ? <GroupStageSection matches={stageMatches} playerId={playerId} sessionToken={sessionToken} />
            : (
              <div className="flex flex-col gap-3">
                {stageMatches
                  .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
                  .map(m => (
                    <MatchCard key={m.id} match={m} playerId={playerId} sessionToken={sessionToken} />
                  ))}
              </div>
            )
          }
        </section>
      ))}
    </div>
  )
}

function GroupStageSection({ matches, playerId, sessionToken }: Props) {
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
                <MatchCard key={m.id} match={m} playerId={playerId} sessionToken={sessionToken} />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

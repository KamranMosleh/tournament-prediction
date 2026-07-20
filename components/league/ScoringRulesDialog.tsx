'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { BookOpen, CheckCircle2, Clock3, Trophy, X } from 'lucide-react'
import type { MatchStage, ScoringMode } from '@/types'
import { BASE_MATCH_POINTS, PENALTY_BONUS_POINTS, STAGE_MULTIPLIERS } from '@/lib/scoring'
import { TOP_SCORER_BONUS_TIERS, WINNER_BONUS_TIERS } from '@/lib/tournament-picks'
import { stageLabel } from '@/lib/utils'

type Props = {
  scoringMode: ScoringMode
}

const STAGES: MatchStage[] = [
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]

export function ScoringRulesDialog({ scoringMode }: Props) {
  const multiplied = scoringMode === 'multiplied'

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          <BookOpen size={11} />
          Rules
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.72)' }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-lg max-h-[85vh] overflow-y-auto rounded-xl p-5 outline-none"
          style={{
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <Dialog.Title className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
                Scoring rules
              </Dialog.Title>
              <Dialog.Description className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Total points are match points plus tournament-pick bonuses.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close scoring rules"
                className="cursor-pointer p-1 rounded-lg"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={17} />
              </button>
            </Dialog.Close>
          </div>

          <div
            className="mb-5 rounded-lg px-3 py-2.5 text-xs"
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid rgba(63,185,80,0.3)',
              color: 'var(--accent)',
            }}
          >
            This league uses <strong>{multiplied ? 'stage-multiplied' : 'flat'}</strong> match scoring.
          </div>

          <RuleSection icon={<CheckCircle2 size={15} />} title="Match predictions">
            <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-4">
              <PointCard label="Exact score" points={BASE_MATCH_POINTS.exact} />
              <PointCard label="Correct difference" points={BASE_MATCH_POINTS.difference} />
              <PointCard label="Correct outcome" points={BASE_MATCH_POINTS.outcome} />
              <PointCard label="Wrong outcome" points={BASE_MATCH_POINTS.wrong} />
            </div>

            {multiplied ? (
              <>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Base points are multiplied by the match stage:
                </p>
                <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                  {STAGES.map((stage, index) => {
                    const multiplier = STAGE_MULTIPLIERS[stage]
                    return (
                      <div
                        key={stage}
                        className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-xs"
                        style={{
                          background: index % 2 === 0 ? 'var(--surface-2)' : 'transparent',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span style={{ color: 'var(--text)' }}>{stageLabel(stage)}</span>
                        <span>x{multiplier}</span>
                        <span className="col-span-2 font-medium tabular-nums">
                          Exact {BASE_MATCH_POINTS.exact * multiplier} / Difference {BASE_MATCH_POINTS.difference * multiplier} / Outcome {BASE_MATCH_POINTS.outcome * multiplier}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Flat mode uses {BASE_MATCH_POINTS.exact}/{BASE_MATCH_POINTS.difference}/{BASE_MATCH_POINTS.outcome}/{BASE_MATCH_POINTS.wrong} points at every stage, with no multipliers.
              </p>
            )}

            <div className="mt-4 rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>
                Penalty shootout bonus
              </p>
              <div className="grid grid-cols-2 gap-2">
                <PointCard label="Flat" points={PENALTY_BONUS_POINTS.flat} />
                <PointCard label="Multiplied" points={PENALTY_BONUS_POINTS.multiplied} />
              </div>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                If a non-group match goes to penalties, a non-draw pick for the advancing team earns outcome points. Draw picks can include a shootout winner for the bonus.
              </p>
            </div>
          </RuleSection>

          <RuleSection icon={<BookOpen size={15} />} title="Standing indexes">
            <ul className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <li><strong style={{ color: 'var(--text)' }}>Overall prediction success</strong>: measures how often submitted picks were useful. Exact scores, correct goal difference, and correct outcome all count as successful; incorrect picks do not. Missed games are not included.</li>
              <li><strong style={{ color: 'var(--text)' }}>Points efficiency</strong>: measures how much of the available match-point value a player captured since joining. It uses the league scoring rules, including stage multipliers and penalty bonuses. Missed games count as zero.</li>
              <li><strong style={{ color: 'var(--text)' }}>Goal error score</strong>: measures scoreline closeness for submitted picks. It averages how many total goals each pick missed by, then converts that to a 0-100 score: 100 means exact scores on average, and lower means further away.</li>
            </ul>
          </RuleSection>

          <RuleSection icon={<Trophy size={15} />} title="Tournament bonuses">
            <BonusTable
              title="Correct tournament winner"
              tiers={WINNER_BONUS_TIERS}
            />
            <div className="mt-4">
              <BonusTable
                title="Correct top scorer"
                tiers={TOP_SCORER_BONUS_TIERS}
              />
            </div>
          </RuleSection>

          <RuleSection icon={<Clock3 size={15} />} title="Deadlines and results" last>
            <ul className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <li>Winner picks lock at final kick-off; top-scorer picks lock at semi-final kick-off.</li>
              <li>Changing a saved pick moves that pick to the bonus tier active at the time of the change.</li>
              <li>The champion is derived from the completed final. The top scorer is imported automatically when the API has one unique goals leader; an admin handles ties, unavailable data, and corrections.</li>
              <li>Bonuses appear once the relevant deadline has passed and the official result is available.</li>
              <li>Top-scorer name matching also accepts reordered names, one full-name component such as a surname alone, and small dictation or spelling errors. Short names remain stricter to avoid false matches.</li>
              <li>Leaderboard ties are decided by the greatest number of exact-score predictions.</li>
            </ul>
          </RuleSection>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function RuleSection({
  icon,
  title,
  children,
  last = false,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <section className={last ? '' : 'pb-5 mb-5'} style={last ? undefined : { borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--gold)' }}>
        {icon}
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function PointCard({ label, points }: { label: string; points: number }) {
  return (
    <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--surface-2)' }}>
      <p className="text-lg font-bold tabular-nums" style={{ color: points > 0 ? 'var(--accent)' : 'var(--text-subtle)' }}>
        {points}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

function BonusTable({
  title,
  tiers,
}: {
  title: string
  tiers: ReadonlyArray<{ label: string; points: number }>
}) {
  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiers.map(tier => (
          <div key={tier.label} className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tier.label}</p>
            <p className="text-sm font-bold mt-0.5 tabular-nums" style={{ color: 'var(--gold)' }}>
              {tier.points} pts
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

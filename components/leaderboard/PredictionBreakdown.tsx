import type { PlayerScore } from '@/types'

interface Props {
  player: PlayerScore
}

export function PredictionBreakdown({ player }: Props) {
  const successfulPredictions = player.exact_scores + player.correct_difference + player.correct_outcome
  const overallPredictionSuccess = player.predictions_submitted > 0
    ? Math.round((successfulPredictions / player.predictions_submitted) * 100)
    : null
  const pointsEfficiency = player.form_max_points > 0
    ? Math.round((player.form_points / player.form_max_points) * 100)
    : null

  return (
    <div
      className="w-full mt-2.5 pt-3 border-t border-dashed flex flex-col gap-2"
      style={{ borderColor: 'var(--border)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex flex-col gap-1 px-1 text-xs sm:flex-row sm:items-center sm:justify-between"
        style={{ color: 'var(--text-muted)' }}
      >
        <MetricWithHint
          label="Overall prediction success"
          value={overallPredictionSuccess === null ? '-' : `${overallPredictionSuccess}%`}
          hint="Share of submitted picks that were not incorrect: exact score, correct difference, or correct outcome."
        />
        <MetricWithHint
          label="Points efficiency"
          value={pointsEfficiency === null ? '-' : `${pointsEfficiency}%`}
          hint="Share of possible match points earned since joining. Missed picks count as zero."
        />
        <MetricWithHint
          label="Goal error score"
          value={player.goal_error_score === null ? '-' : `${player.goal_error_score}`}
          hint={goalErrorHint(player.average_goal_error)}
          align="right"
        />
      </div>

      {player.tournament_points > 0 && (
        <p className="px-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
          Tournament bonus +{player.tournament_points} pts
        </p>
      )}

      <div className="flex justify-between items-center text-xs px-1">
        <span className="font-semibold text-xs" style={{ color: 'var(--text)' }}>
          Prediction Distribution
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          {player.predictions_submitted} matches predicted
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 sm:gap-2 mt-1">
        <DistributionCell
          value={player.exact_scores}
          shortLabel="Exact"
          label="Exact Score"
          color="var(--accent)"
          background="rgba(63, 185, 80, 0.05)"
          border="rgba(63, 185, 80, 0.15)"
        />
        <DistributionCell
          value={player.correct_difference}
          label="Difference"
          color="var(--blue)"
          background="rgba(88, 166, 255, 0.05)"
          border="rgba(88, 166, 255, 0.15)"
        />
        <DistributionCell
          value={player.correct_outcome}
          shortLabel="Outcome"
          label="Outcome Only"
          color="var(--gold)"
          background="rgba(210, 153, 34, 0.05)"
          border="rgba(210, 153, 34, 0.15)"
        />
        <DistributionCell
          value={player.wrong_outcome}
          label="Incorrect"
          color="var(--red)"
          background="rgba(248, 81, 73, 0.05)"
          border="rgba(248, 81, 73, 0.15)"
        />
      </div>
    </div>
  )
}

function goalErrorHint(averageGoalError: number | null): string {
  const prefix = averageGoalError === null
    ? 'No finished predictions yet.'
    : `Average score miss is ${averageGoalError.toFixed(1)} goals per match.`

  return `${prefix} 100 means exact scores on average; lower means further from the real scores.`
}

function MetricWithHint({
  label,
  value,
  hint,
  align = 'left',
}: {
  label: string
  value: string
  hint: string
  align?: 'left' | 'right'
}) {
  const alignClass = align === 'right' ? 'sm:right-0 sm:left-auto' : 'left-0'

  return (
    <span
      className="group relative inline-flex w-fit cursor-help items-center gap-1 outline-none"
      tabIndex={0}
      title={hint}
    >
      <span className="underline decoration-dotted underline-offset-4">
        {label}
      </span>
      <strong className="tabular-nums" style={{ color: 'var(--accent)' }}>
        {value}
      </strong>
      <span
        className={`pointer-events-none absolute top-full z-30 mt-1 w-56 rounded-md px-2.5 py-2 text-left text-[11px] font-medium leading-snug opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${alignClass}`}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        {hint}
      </span>
    </span>
  )
}

function DistributionCell({
  value,
  label,
  shortLabel,
  color,
  background,
  border,
}: {
  value: number
  label: string
  shortLabel?: string
  color: string
  background: string
  border: string
}) {
  return (
    <div
      className="rounded-md sm:rounded-lg px-1 py-1.5 sm:p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
      style={{ background, border: `1px solid ${border}` }}
    >
      <span className="text-base sm:text-lg leading-none font-bold" style={{ color }}>
        {value}
      </span>
      <span
        className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-wider font-semibold opacity-80 leading-none text-center"
        style={{ color: 'var(--text-muted)' }}
      >
        {shortLabel ? <span className="sm:hidden">{shortLabel}</span> : null}
        <span className={shortLabel ? 'hidden sm:inline' : undefined}>{label}</span>
      </span>
    </div>
  )
}

import type { PlayerScore } from '@/types'

interface Props {
  player: PlayerScore
}

export function PredictionBreakdown({ player }: Props) {
  return (
    <div className="w-full mt-2.5 pt-3 border-t border-dashed flex flex-col gap-2"
      style={{ borderColor: 'var(--border)' }}
      onClick={(e) => e.stopPropagation()}>
      
      <div className="flex justify-between items-center text-xs px-1">
        <span className="font-semibold text-xs" style={{ color: 'var(--text)' }}>
          Prediction Distribution
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          {player.predictions_submitted} matches predicted
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
        
        {/* Exact Score */}
        <div className="rounded-lg p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
          style={{ background: 'rgba(63, 185, 80, 0.05)', border: '1px solid rgba(63, 185, 80, 0.15)' }}>
          <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
            {player.exact_scores}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80" style={{ color: 'var(--text-muted)' }}>
            Exact Score
          </span>
        </div>

        {/* Correct Difference */}
        <div className="rounded-lg p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
          style={{ background: 'rgba(88, 166, 255, 0.05)', border: '1px solid rgba(88, 166, 255, 0.15)' }}>
          <span className="text-lg font-bold" style={{ color: 'var(--blue)' }}>
            {player.correct_difference}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80" style={{ color: 'var(--text-muted)' }}>
            Difference
          </span>
        </div>

        {/* Correct Outcome */}
        <div className="rounded-lg p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
          style={{ background: 'rgba(210, 153, 34, 0.05)', border: '1px solid rgba(210, 153, 34, 0.15)' }}>
          <span className="text-lg font-bold" style={{ color: 'var(--gold)' }}>
            {player.correct_outcome}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80" style={{ color: 'var(--text-muted)' }}>
            Outcome Only
          </span>
        </div>

        {/* Wrong Outcome */}
        <div className="rounded-lg p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
          style={{ background: 'rgba(248, 81, 73, 0.05)', border: '1px solid rgba(248, 81, 73, 0.15)' }}>
          <span className="text-lg font-bold" style={{ color: 'var(--red)' }}>
            {player.wrong_outcome}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80" style={{ color: 'var(--text-muted)' }}>
            Incorrect
          </span>
        </div>

      </div>
    </div>
  )
}

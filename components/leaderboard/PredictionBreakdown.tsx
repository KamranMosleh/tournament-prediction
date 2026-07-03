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

      <div className="grid grid-cols-4 gap-1 sm:gap-2 mt-1">
        
        {/* Exact Score */}
        <div className="rounded-md sm:rounded-lg px-1 py-1.5 sm:p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
          style={{ background: 'rgba(63, 185, 80, 0.05)', border: '1px solid rgba(63, 185, 80, 0.15)' }}>
          <span className="text-base sm:text-lg leading-none font-bold" style={{ color: 'var(--accent)' }}>
            {player.exact_scores}
          </span>
          <span className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-wider font-semibold opacity-80 leading-none text-center" style={{ color: 'var(--text-muted)' }}>
            <span className="sm:hidden">Exact</span>
            <span className="hidden sm:inline">Exact Score</span>
          </span>
        </div>

        {/* Correct Difference */}
        <div className="rounded-md sm:rounded-lg px-1 py-1.5 sm:p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
          style={{ background: 'rgba(88, 166, 255, 0.05)', border: '1px solid rgba(88, 166, 255, 0.15)' }}>
          <span className="text-base sm:text-lg leading-none font-bold" style={{ color: 'var(--blue)' }}>
            {player.correct_difference}
          </span>
          <span className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-wider font-semibold opacity-80 leading-none text-center" style={{ color: 'var(--text-muted)' }}>
            Difference
          </span>
        </div>

        {/* Correct Outcome */}
        <div className="rounded-md sm:rounded-lg px-1 py-1.5 sm:p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
          style={{ background: 'rgba(210, 153, 34, 0.05)', border: '1px solid rgba(210, 153, 34, 0.15)' }}>
          <span className="text-base sm:text-lg leading-none font-bold" style={{ color: 'var(--gold)' }}>
            {player.correct_outcome}
          </span>
          <span className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-wider font-semibold opacity-80 leading-none text-center" style={{ color: 'var(--text-muted)' }}>
            <span className="sm:hidden">Outcome</span>
            <span className="hidden sm:inline">Outcome Only</span>
          </span>
        </div>

        {/* Wrong Outcome */}
        <div className="rounded-md sm:rounded-lg px-1 py-1.5 sm:p-2 flex flex-col items-center justify-center transition-all hover:bg-opacity-80"
          style={{ background: 'rgba(248, 81, 73, 0.05)', border: '1px solid rgba(248, 81, 73, 0.15)' }}>
          <span className="text-base sm:text-lg leading-none font-bold" style={{ color: 'var(--red)' }}>
            {player.wrong_outcome}
          </span>
          <span className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-wider font-semibold opacity-80 leading-none text-center" style={{ color: 'var(--text-muted)' }}>
            Incorrect
          </span>
        </div>

      </div>
    </div>
  )
}

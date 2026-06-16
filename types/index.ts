export type MatchStatus = 'open' | 'locked' | 'finished'
export type MatchStage = 'group' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final'
export type SyncSource = 'api' | 'manual'
export type ScoringMode = 'multiplied' | 'flat'
export type AIDifficulty = 'Easy' | 'Tricky' | 'Unpredictable'

export interface League {
  id: string
  name: string
  invite_code: string
  tournament: string
  tournament_code: string
  tournament_season: number
  created_by: string | null
  sync_source: SyncSource
  scoring_mode: ScoringMode
  telegram_url: string | null
  created_at: string
}

export interface Player {
  id: string
  league_id: string
  display_name: string
  session_token: string
  is_admin: boolean
  joined_at: string
  joined_match_day: number | null
}

export interface Match {
  id: string
  tournament_code: string
  tournament_season: number
  external_match_id: number | null
  stage: MatchStage
  group_name: string | null
  home_team: string
  away_team: string
  kickoff_time: string
  status: MatchStatus
  home_score: number | null
  away_score: number | null
  match_day: number | null
  venue: string | null
  ai_insight: string | null
  ai_difficulty: AIDifficulty | null
  last_synced_at: string | null
}

export interface MatchPrediction {
  id: string
  player_id: string
  match_id: string
  home_score: number
  away_score: number
  submitted_at: string
}

export interface TournamentPrediction {
  id: string
  player_id: string
  league_id: string
  winner_team: string
  top_scorer_name: string
  submitted_at: string
  winner_submitted_at?: string | null
  top_scorer_submitted_at?: string | null
}

export interface MatchdaySummary {
  id: string
  league_id: string
  match_day: number
  summary_text: string
  generated_at: string
}

export interface PlayerRoast {
  player_name: string
  prediction: string | null  // e.g. "2-1", or null if no prediction submitted
  actual: string             // e.g. "3-0"
  points: number
  roast: string              // one playful sentence
}

export interface MatchRecap {
  id: string
  league_id: string
  match_id: string
  headline: string
  roasts: PlayerRoast[]
  generated_at: string
}

export interface MatchRevealAggregate {
  total_players: number
  predicted_count: number
  missing_count: number
  top_scores: Array<{ score: string; count: number }>
  outcome_counts: {
    home_win: number
    draw: number
    away_win: number
  }
}

export interface MatchRevealEntry {
  player_id: string
  player_name: string
  score: string
  points: number | null
}

export interface MatchRevealData {
  aggregate: MatchRevealAggregate
  entries: MatchRevealEntry[]
}

export interface PlayerScore {
  player_id: string
  display_name: string
  joined_match_day: number | null
  match_points: number
  tournament_points: number
  total_points: number
  exact_scores: number
  predictions_submitted: number
  form_points: number
  form_max_points: number
}

export interface MatchWithPrediction extends Match {
  prediction?: MatchPrediction | null
}

export interface Session {
  player_id: string
  session_token: string
  display_name: string
  league_id: string
  league_name: string
  invite_code: string
  is_admin: boolean
}

// Shape stored in localStorage
export type SessionsMap = Record<string, Session>

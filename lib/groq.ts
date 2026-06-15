const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

export async function groqComplete(prompt: string, maxTokens = 200): Promise<string | null> {
  const key = process.env.GROQ_API_KEY
  if (!key) return null   // graceful — AI features silently disabled

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

/**
 * Insight prompt — accepts optional live context from our DB.
 * With context: writes about actual current form.
 * Without context: falls back to general football knowledge.
 */
export function insightPrompt(
  homeTeam: string,
  awayTeam: string,
  tournament: string,
  stage: string,
  liveContext?: string
): string {
  const contextBlock = liveContext
    ? `\n\nLive tournament data (use this to write accurate, specific insights):\n${liveContext}`
    : '\n\nNo live match data available yet — use your general football knowledge.'

  return `You are a concise football analyst. Write exactly 2 sentences about the upcoming match: ${homeTeam} vs ${awayTeam} in the ${tournament} (${stage.replace(/_/g, ' ')}).${contextBlock}\nFocus on current form, key stats, or what makes this match interesting. Be specific and factual. Do not mention predictions or scores.`
}

export function punditsPrompt(
  matchDay: number,
  results: string,
  leaderboard: string
): string {
  return `You are a witty football TV pundit. Write a single paragraph (3-4 sentences) recapping Matchday ${matchDay} for a prediction game.\n\nResults: ${results}\nTop leaderboard: ${leaderboard}\n\nName specific players and matches. Highlight the biggest mover. End with a look ahead. Keep it fun and pundit-like.`
}

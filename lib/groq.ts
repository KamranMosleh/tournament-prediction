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

  return `You are a concise football analyst. Write exactly 3 short sentences about the upcoming match: ${homeTeam} vs ${awayTeam} in the ${tournament} (${stage.replace(/_/g, ' ')}).${contextBlock}\nUse clear intermediate English for international users. Keep each sentence easy to read. Simple and common football jargon is allowed, but avoid advanced or technical terms. Focus on current form, key stats, or what makes this match interesting. Be specific and factual. Do not mention predictions or scores.`
}

export function punditsPrompt(
  matchDay: number,
  results: string,
  leaderboard: string
): string {
  return `You are a witty football TV pundit. Write a single paragraph (3-4 sentences) recapping the latest completed round of matches for a prediction game.\n\nInternal matchday id: ${matchDay}\nResults: ${results}\nTop leaderboard: ${leaderboard}\n\nName specific players and matches. Highlight the biggest mover. End with a look ahead. Keep it fun and pundit-like. Do not call it "Matchday ${matchDay}" in the recap text; use natural phrases like "this round", "the latest results", or "these games" instead.`
}

export interface PlayerPredictionInput {
  name: string
  prediction: string | null  // "2-1" or null
  points: number
}

export function matchRecapPrompt(
  homeTeam: string,
  awayTeam: string,
  actualResult: string,
  players: PlayerPredictionInput[]
): string {
  const lines = players
    .map(p =>
      p.prediction
        ? `- ${p.name}: predicted ${p.prediction} → earned ${p.points} pt${p.points !== 1 ? 's' : ''}`
        : `- ${p.name}: did not predict`
    )
    .join('\n')

  return `You are a witty football TV pundit running a friends prediction game. A match just ended.

Match: ${homeTeam} vs ${awayTeam}
Actual result: ${actualResult}

Player predictions:
${lines}

Respond ONLY with a valid JSON object — no markdown, no explanation, nothing else — in exactly this format:
{
  "headline": "One punchy funny sentence recapping the result (max 20 words)",
  "roasts": [
    {
      "player_name": "<exact name from the list above>",
      "roast": "<One playful sentence, max 25 words. Mention their predicted score vs actual. Warm pub-banter tone, never cruel or offensive.>"
    }
  ]
}

Rules:
- Include every player in roasts, same order as the list above
- Players who did not predict should get a gentle ribbing about not showing up
- Tone: friendly football pub banter — fun, never mean or personal
- Do NOT output any text outside the JSON object`
}

/**
 * Like groqComplete but parses and returns typed JSON.
 * Returns null on any failure (Groq error, parse error, schema mismatch).
 */
export async function groqCompleteJSON<T>(prompt: string, maxTokens = 600): Promise<T | null> {
  const raw = await groqComplete(prompt, maxTokens)
  if (!raw) return null
  try {
    // Strip optional markdown code fences the model sometimes adds
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

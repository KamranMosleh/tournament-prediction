import type { Match } from '@/types'

type VenueTimeZone = {
  city: string
  timeZone: string
  hints: string[]
}

const HOST_TIME_ZONES: VenueTimeZone[] = [
  { city: 'Atlanta', timeZone: 'America/New_York', hints: ['atlanta', 'atlanta stadium', 'mercedes benz'] },
  { city: 'Boston', timeZone: 'America/New_York', hints: ['boston', 'boston stadium', 'gillette', 'foxborough'] },
  { city: 'Miami', timeZone: 'America/New_York', hints: ['miami', 'miami stadium', 'hard rock'] },
  { city: 'New York/New Jersey', timeZone: 'America/New_York', hints: ['new york new jersey', 'new york', 'new jersey', 'nynj', 'metlife', 'east rutherford'] },
  { city: 'Philadelphia', timeZone: 'America/New_York', hints: ['philadelphia', 'philadelphia stadium', 'lincoln financial'] },
  { city: 'Toronto', timeZone: 'America/Toronto', hints: ['toronto', 'toronto stadium', 'bmo field'] },
  { city: 'Dallas', timeZone: 'America/Chicago', hints: ['dallas', 'dallas stadium', 'at and t stadium', 'att stadium', 'arlington'] },
  { city: 'Houston', timeZone: 'America/Chicago', hints: ['houston', 'houston stadium', 'nrg'] },
  { city: 'Kansas City', timeZone: 'America/Chicago', hints: ['kansas city', 'kansas city stadium', 'arrowhead'] },
  { city: 'Guadalajara', timeZone: 'America/Mexico_City', hints: ['guadalajara', 'guadalajara stadium', 'estadio akron'] },
  { city: 'Mexico City', timeZone: 'America/Mexico_City', hints: ['mexico city', 'mexico city stadium', 'estadio azteca', 'estadio banorte'] },
  { city: 'Monterrey', timeZone: 'America/Monterrey', hints: ['monterrey', 'monterrey stadium', 'estadio bbva'] },
  { city: 'Los Angeles', timeZone: 'America/Los_Angeles', hints: ['los angeles', 'los angeles stadium', 'sofi', 'inglewood'] },
  { city: 'San Francisco Bay Area', timeZone: 'America/Los_Angeles', hints: ['san francisco bay area', 'san francisco', 'santa clara', 'levi'] },
  { city: 'Seattle', timeZone: 'America/Los_Angeles', hints: ['seattle', 'seattle stadium', 'lumen'] },
  { city: 'Vancouver', timeZone: 'America/Vancouver', hints: ['vancouver', 'vancouver stadium', 'bc place'] },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function normalizeVenue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function resolveVenueTimeZone(venue: string | null): { city: string; timeZone: string } | null {
  if (!venue) return null
  const normalized = normalizeVenue(venue)
  if (!normalized) return null

  for (const entry of HOST_TIME_ZONES) {
    if (entry.hints.some(hint => normalized.includes(normalizeVenue(hint)))) {
      return { city: entry.city, timeZone: entry.timeZone }
    }
  }

  return null
}

export function formatDateInTimeZone(isoDate: string, timeZone: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 10)

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const year = parts.find(part => part.type === 'year')?.value
    const month = parts.find(part => part.type === 'month')?.value
    const day = parts.find(part => part.type === 'day')?.value
    if (year && month && day) return `${year}-${month}-${day}`
  } catch {
    // Unknown timezones should not block recap generation.
  }

  return date.toISOString().slice(0, 10)
}

export function getVenueLocalDateInfo(
  match: Pick<Match, 'kickoff_time' | 'venue'>
): { localDate: string; timeZone: string; city: string | null; usedFallback: boolean } {
  const resolved = resolveVenueTimeZone(match.venue)
  const timeZone = resolved?.timeZone ?? 'UTC'

  return {
    localDate: formatDateInTimeZone(match.kickoff_time, timeZone),
    timeZone,
    city: resolved?.city ?? null,
    usedFallback: !resolved,
  }
}

export function formatCoverageLabel(localDate: string): string {
  const [, rawMonth, rawDay] = localDate.split('-')
  const month = Number(rawMonth)
  const day = Number(rawDay)
  if (!month || !day) return `${localDate} games`
  return `${MONTHS[month - 1] ?? rawMonth} ${day} games`
}

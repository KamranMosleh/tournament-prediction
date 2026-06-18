import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { MatchStage } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function avatarColor(name: string): string {
  const colors = ['#3fb950','#58a6ff','#d29922','#f85149','#bc8cff','#79c0ff','#56d364','#e3b341']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function stageLabel(stage: MatchStage): string {
  const labels: Record<MatchStage, string> = {
    group: 'Group Stage', round_of_16: 'Round of 16', quarter_final: 'Quarter-Finals',
    semi_final: 'Semi-Finals', third_place: 'Third Place', final: 'Final',
  }
  return labels[stage]
}

export function stageOrder(stage: MatchStage): number {
  const order: Record<MatchStage, number> = {
    group: 0, round_of_16: 1, quarter_final: 2, semi_final: 3, third_place: 4, final: 5,
  }
  return order[stage]
}

export function formatKickoff(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

export function timeUntil(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0 || diff > 48 * 3_600_000) return null
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

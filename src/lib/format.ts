export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h${m}m`
}

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export interface PauseState {
  paused: boolean
  pauseStartMs: number | null
  pausedTotalMs: number
}

export const PAUSE_NONE: PauseState = { paused: false, pauseStartMs: null, pausedTotalMs: 0 }

export function pausedElapsedSeconds(startedAt: string, pause: PauseState): number {
  const start = new Date(startedAt.replace(' ', 'T')).getTime()
  const currentPauseMs = pause.paused && pause.pauseStartMs !== null ? Date.now() - pause.pauseStartMs : 0
  return Math.max(0, Math.floor((Date.now() - start - pause.pausedTotalMs - currentPauseMs) / 1000))
}

// Local calendar date as "YYYY-MM-DD" (matches how the Rust backend stamps
// entries via chrono::Local — avoids an off-by-one around midnight in UTC+N).
export function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function formatDate(dateStr: string): string {
  if (dateStr === todayLocal()) return 'Today'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(createdAt: string): string {
  return createdAt.slice(11, 16)
}

export function isoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// Number of ISO weeks in a year: 53 if 1 Jan is a Thursday, or (in leap years)
// a Wednesday; otherwise 52. Used so week navigation can reach W53.
export function isoWeeksInYear(year: number): number {
  const jan1Dow = new Date(Date.UTC(year, 0, 1)).getUTCDay() // 0=Sun..6=Sat
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  if (jan1Dow === 4 || (isLeap && jan1Dow === 3)) return 53
  return 52
}

// Monday–Sunday date range ("YYYY-MM-DD") for an ISO week string "YYYY-Www".
// TS counterpart to iso_week_to_date_range in src-tauri/src/commands/meta.rs.
export function isoWeekToDateRange(isoWeekStr: string): { from: string; to: string } | null {
  const [yearStr, weekStr] = isoWeekStr.split('-W')
  const year = parseInt(yearStr, 10)
  const week = parseInt(weekStr, 10)
  if (!Number.isFinite(year) || !Number.isFinite(week)) return null
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = jan4.getUTCDay() || 7 // Mon=1..Sun=7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1))
  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(monday), to: fmt(sunday) }
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

export function firstLine(text: string): string {
  return text.split('\n')[0]
}

// "2026-06-17 14:00:00" -> "17.06 14:00"
export function formatScheduled(s: string): string {
  const date = s.slice(8, 10) + '.' + s.slice(5, 7)
  const time = s.slice(11, 16)
  return `${date} ${time}`
}

// minutes -> compact hours, e.g. 90 -> "1.5h", 120 -> "2h"
export function formatEstDuration(min: number): string {
  const h = min / 60
  const str = Number.isInteger(h) ? String(h) : h.toFixed(1)
  return `${str}h`
}

// Termin in the past and todo not done.
export function isOverdue(scheduledAt: string): boolean {
  return new Date(scheduledAt.replace(' ', 'T')).getTime() < Date.now()
}

// Parse a scheduled string "YYYY-MM-DD HH:MM:SS" into a local Date.
export function parseScheduled(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

// Date -> "YYYY-MM-DD HH:MM:SS" using local components (counterpart to parseScheduled).
export function toScheduledString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

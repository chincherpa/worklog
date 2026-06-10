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

export function elapsedSeconds(startedAt: string): number {
  const start = new Date(startedAt.replace(' ', 'T')).getTime()
  return Math.floor((Date.now() - start) / 1000)
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

export function formatDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr === today) return 'Heute'
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
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

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

export function firstLine(text: string): string {
  return text.split('\n')[0]
}

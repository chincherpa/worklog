export interface LogEntry {
  id: number
  date: string
  created_at: string
  tag_key: string
  project: string
  content: string
  todo_id: number | null
  resolved: number
}

export interface DayMeta {
  date: string
  morning_focus: string | null
  morning_energy: number | null
  evening_done: string | null
  evening_open: string | null
  day_rating: string | null
  evening_note: string | null
  work_locked: boolean
}

export interface Todo {
  id: number
  title: string
  context: string | null
  status: string
  priority: string
  tags: string[]
  created_at: string
  done_at: string | null
  sort_order: number
  scheduled_at: string | null
  est_duration_min: number | null
  total_sessions: number
  total_duration_s: number
}

export interface FocusSession {
  id: number
  todo_id: number
  started_at: string
  ended_at: string | null
  duration_s: number | null
  timer_preset: string | null
  outcome: string | null
  log_entry: string | null
}

export interface TodoNote {
  id: number
  todo_id: number
  session_id: number | null
  created_at: string
  content: string
}

export interface SubTodo {
  id: number
  todo_id: number
  title: string
  done: boolean
  created_at: string
}

export interface Tag {
  key: string
  symbol: string
  name: string
  color: string
  bg_color?: string
}

export interface Project {
  key: string
  symbol: string
  name: string
  color: string
  bg_color?: string
}

export interface Keybinding {
  action: string
  keys: string[]
}

export interface AppConfig {
  tags: Tag[]
  projects: Project[]
  keybindings: Keybinding[]
  config_path: string
  db_path: string
}

export interface WeekSummary {
  iso_week: string
  work_days: number
  log_counts: Record<string, number>
  avg_energy: number | null
  top_tags: [string, number][]
  open_blocks: number
  focus_total_s: number
  day_ratings: string[]
}

export type SearchHitKind = 'log' | 'todo' | 'note' | 'subtodo'

export interface SearchHit {
  kind: SearchHitKind
  id: number
  target_todo_id: number | null
  title: string
  snippet: string
  date: string | null
}

export type ActivePanel = 'log' | 'content' | 'todo'
export type ToastSeverity = 'info' | 'warning' | 'error' | 'success'

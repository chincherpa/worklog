import { invoke } from '@tauri-apps/api/core'
import type {
  AppConfig,
  DayMeta,
  FocusSession,
  LogEntry,
  Project,
  SearchHit,
  SubTodo,
  Tag,
  Todo,
  TodoNote,
  WeekSummary,
} from '../types'

export const api = {
  // Config
  getConfig: (configPath?: string) =>
    invoke<AppConfig>('get_config', { configPath }),
  getDbPath: (configPath?: string) =>
    invoke<string>('get_db_path', { configPath }),
  initDb: (dbPath: string) =>
    invoke<number>('init_db', { dbPath }),
  saveTags: (configPath: string, tags: Tag[]) =>
    invoke<void>('save_tags', { configPath, tags }),
  saveProjects: (configPath: string, projects: Project[]) =>
    invoke<void>('save_projects', { configPath, projects }),

  // Log
  logAdd: (dbPath: string, tagKey: string, content: string, projectKey?: string, todoId?: number) =>
    invoke<LogEntry>('log_add', { dbPath, tagKey, content, projectKey, todoId }),
  logGet: (dbPath: string, entryId: number) =>
    invoke<LogEntry>('log_get', { dbPath, entryId }),
  logUpdate: (dbPath: string, entryId: number, content?: string, tagKey?: string, resolved?: number, projectKey?: string) =>
    invoke<LogEntry>('log_update', { dbPath, entryId, content, tagKey, resolved, projectKey }),
  logGetAll: (dbPath: string) =>
    invoke<LogEntry[]>('log_get_all', { dbPath }),
  logDelete: (dbPath: string, entryId: number) =>
    invoke<boolean>('log_delete', { dbPath, entryId }),
  logUsedTags: (dbPath: string) =>
    invoke<string[]>('log_used_tags', { dbPath }),
  logGetRange: (dbPath: string, dateFrom: string, dateTo: string, tagKey?: string) =>
    invoke<LogEntry[]>('log_get_range', { dbPath, dateFrom, dateTo, tagKey }),
  logSearch: (dbPath: string, query: string, limit?: number) =>
    invoke<LogEntry[]>('log_search', { dbPath, query, limit }),
  globalSearch: (dbPath: string, query: string, limit?: number) =>
    invoke<SearchHit[]>('global_search', { dbPath, query, limit }),

  // Todo
  todoAdd: (dbPath: string, title: string, context?: string, priority?: string) =>
    invoke<Todo>('todo_add', { dbPath, title, context, priority }),
  todoGet: (dbPath: string, todoId: number) =>
    invoke<Todo>('todo_get', { dbPath, todoId }),
  todoList: (dbPath: string, status?: string) =>
    invoke<Todo[]>('todo_list', { dbPath, status }),
  todoSetStatus: (dbPath: string, todoId: number, status: string) =>
    invoke<Todo>('todo_set_status', { dbPath, todoId, status }),
  todoUpdate: (dbPath: string, todoId: number, title?: string, context?: string, priority?: string) =>
    invoke<Todo>('todo_update', { dbPath, todoId, title, context, priority }),
  todoDelete: (dbPath: string, todoId: number) =>
    invoke<boolean>('todo_delete', { dbPath, todoId }),
  todoReorder: (dbPath: string, todoId: number, direction: 1 | -1) =>
    invoke<Todo[]>('todo_reorder', { dbPath, todoId, direction }),
  todoSearch: (dbPath: string, query: string, limit?: number) =>
    invoke<Todo[]>('todo_search', { dbPath, query, limit }),

  // Session
  sessionStart: (dbPath: string, todoId: number, timerPreset?: string) =>
    invoke<FocusSession>('session_start', { dbPath, todoId, timerPreset }),
  sessionEnd: (dbPath: string, sessionId: number, outcome: string, logEntry?: string) =>
    invoke<FocusSession>('session_end', { dbPath, sessionId, outcome, logEntry }),
  sessionGet: (dbPath: string, sessionId: number) =>
    invoke<FocusSession>('session_get', { dbPath, sessionId }),
  sessionGetActive: (dbPath: string) =>
    invoke<FocusSession | null>('session_get_active', { dbPath }),
  sessionCloseDangling: (dbPath: string) =>
    invoke<number>('session_close_dangling', { dbPath }),
  sessionListForTodo: (dbPath: string, todoId: number) =>
    invoke<FocusSession[]>('session_list_for_todo', { dbPath, todoId }),
  sessionTotalToday: (dbPath: string) =>
    invoke<number>('session_total_today', { dbPath }),

  // Notes
  noteAdd: (dbPath: string, todoId: number, content: string, sessionId?: number) =>
    invoke<TodoNote>('note_add', { dbPath, todoId, content, sessionId }),
  noteGet: (dbPath: string, noteId: number) =>
    invoke<TodoNote>('note_get', { dbPath, noteId }),
  noteListForTodo: (dbPath: string, todoId: number) =>
    invoke<TodoNote[]>('note_list_for_todo', { dbPath, todoId }),
  noteListForSession: (dbPath: string, sessionId: number) =>
    invoke<TodoNote[]>('note_list_for_session', { dbPath, sessionId }),
  noteDelete: (dbPath: string, noteId: number) =>
    invoke<boolean>('note_delete', { dbPath, noteId }),

  // SubTodos
  subtodoAdd: (dbPath: string, todoId: number, title: string) =>
    invoke<SubTodo>('subtodo_add', { dbPath, todoId, title }),
  subtodoGet: (dbPath: string, subtodoId: number) =>
    invoke<SubTodo>('subtodo_get', { dbPath, subtodoId }),
  subtodoListForTodo: (dbPath: string, todoId: number) =>
    invoke<SubTodo[]>('subtodo_list_for_todo', { dbPath, todoId }),
  subtodoToggle: (dbPath: string, subtodoId: number) =>
    invoke<SubTodo>('subtodo_toggle', { dbPath, subtodoId }),
  subtodoDelete: (dbPath: string, subtodoId: number) =>
    invoke<boolean>('subtodo_delete', { dbPath, subtodoId }),

  // Day meta
  dayGet: (dbPath: string, dateStr?: string) =>
    invoke<DayMeta | null>('day_get', { dbPath, dateStr }),
  dayGetOrCreate: (dbPath: string, dateStr?: string) =>
    invoke<DayMeta>('day_get_or_create', { dbPath, dateStr }),
  daySetMorning: (dbPath: string, focus: string, energy: number, dateStr?: string) =>
    invoke<DayMeta>('day_set_morning', { dbPath, focus, energy, dateStr }),
  daySetEvening: (dbPath: string, done: string, openItems: string, rating: string, note?: string, dateStr?: string) =>
    invoke<DayMeta>('day_set_evening', { dbPath, done, openItems, rating, note, dateStr }),
  dayIsWorkLocked: (dbPath: string, dateStr?: string) =>
    invoke<boolean>('day_is_work_locked', { dbPath, dateStr }),
  weekSummary: (dbPath: string, isoWeek: string) =>
    invoke<WeekSummary>('week_summary', { dbPath, isoWeek }),

  // Git
  gitPushDb: (dbPath: string) =>
    invoke<void>('git_push_db', { dbPath }),

  openDbFile: (dbPath: string) =>
    invoke<void>('open_db_file', { dbPath }),
}

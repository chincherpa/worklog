import { useState, useCallback, useRef, useEffect } from 'react'
import { api } from './lib/invoke'
import type { ActivePanel, AppConfig, FocusSession, LogEntry, Tag, Todo } from './types'

const DONE_STATUSES = new Set(['done', 'cancelled', 'dropped'])

function sortTodosForDisplay(todos: Todo[]): Todo[] {
  const active = todos.filter(t => !DONE_STATUSES.has(t.status))
  const done = todos.filter(t => DONE_STATUSES.has(t.status))
  return [...active, ...done]
}

export interface AppState {
  config: AppConfig | null
  dbPath: string
  logEntries: LogEntry[]
  todos: Todo[]
  carryOver: LogEntry[]
  activeSession: FocusSession | null
  tagIdx: number
  todoIdx: number
  logFilter: string | null
  filterKeys: string[]
  displayedEntryId: number | null
  activePanel: ActivePanel
  contentVisible: boolean
  todoVisible: boolean
  dialogOpen: boolean
  inputFocused: boolean
  error: string | null
}

export interface AppActions {
  loadAll: () => Promise<void>
  loadLog: () => Promise<void>
  loadTodos: () => Promise<void>
  workTags: () => Tag[]
  currentTag: () => Tag | null
  cycleTag: (dir: 1 | -1) => void
  cycleFilter: (dir: 1 | -1) => void
  setFilter: (key: string | null) => void
  setDisplayedEntry: (id: number | null) => void
  setTodoIdx: (idx: number) => void
  moveTodoIdx: (dir: 1 | -1) => void
  moveLogIdx: (dir: 1 | -1) => void
  setActivePanel: (panel: ActivePanel) => void
  cyclePanel: (dir: 1 | -1) => void
  setContentVisible: (v: boolean) => void
  setTodoVisible: (v: boolean) => void
  setDialogOpen: (v: boolean) => void
  setInputFocused: (v: boolean) => void
  setConfig: (config: AppConfig) => void
  setTagIdx: (idx: number) => void
}

const INITIAL: AppState = {
  config: null,
  dbPath: '',
  logEntries: [],
  todos: [],
  carryOver: [],
  activeSession: null,
  tagIdx: 0,
  todoIdx: 0,
  logFilter: null,
  filterKeys: [],
  displayedEntryId: null,
  activePanel: 'log',
  contentVisible: true,
  todoVisible: true,
  dialogOpen: false,
  inputFocused: false,
  error: null,
}

export function useAppState(): AppState & AppActions {
  const [state, setState] = useState<AppState>(INITIAL)
  const stateRef = useRef(state)
  stateRef.current = state

  const loadAll = useCallback(async () => {
    const s = stateRef.current
    if (!s.dbPath) {
      console.warn('loadAll: dbPath empty, skipping')
      return
    }
    console.log('loadAll: calling with dbPath=', s.dbPath)
    try {
      const [entriesRes, todosRes, blocksRes, sessionRes] = await Promise.allSettled([
        api.logGetAll(s.dbPath),
        api.todoList(s.dbPath),
        api.logGetOpenBlocks(s.dbPath),
        api.sessionGetActive(s.dbPath),
      ])

      if (entriesRes.status === 'rejected') console.error('logGetAll failed:', entriesRes.reason)
      else console.log('logGetAll ok, count=', entriesRes.value.length)
      if (todosRes.status === 'rejected') console.error('todoList failed:', todosRes.reason)
      else console.log('todoList ok, count=', todosRes.value.length, 'dbPath=', s.dbPath)
      if (blocksRes.status === 'rejected') console.error('logGetOpenBlocks failed:', blocksRes.reason)
      if (sessionRes.status === 'rejected') console.error('sessionGetActive failed:', sessionRes.reason)

      const entries = entriesRes.status === 'fulfilled' ? entriesRes.value : []
      const todos = todosRes.status === 'fulfilled' ? sortTodosForDisplay(todosRes.value) : []
      const blocks = blocksRes.status === 'fulfilled' ? blocksRes.value : []
      const session = sessionRes.status === 'fulfilled' ? sessionRes.value : null
      const usedTags = [...new Set(entries.map(e => e.tag_key))]

      setState(prev => {
        let displayedEntryId = prev.displayedEntryId
        if (!displayedEntryId && entries.length > 0) {
          displayedEntryId = entries[0].id
        }
        return {
          ...prev,
          logEntries: entries,
          todos,
          carryOver: blocks,
          activeSession: session,
          filterKeys: usedTags,
          displayedEntryId,
          error: null,
        }
      })
    } catch (e) {
      console.error('loadAll failed:', e)
      setState(prev => ({ ...prev, error: String(e) }))
    }
  }, [])

  const loadLog = useCallback(async () => {
    const s = stateRef.current
    if (!s.dbPath) return
    try {
      const entries = await api.logGetAll(s.dbPath)
      const usedTags = [...new Set(entries.map((e: LogEntry) => e.tag_key))]
      setState(prev => ({
        ...prev,
        logEntries: entries,
        filterKeys: usedTags,
        displayedEntryId: prev.displayedEntryId ?? (entries[0]?.id ?? null),
      }))
    } catch (e) {
      setState(prev => ({ ...prev, error: String(e) }))
    }
  }, [])

  const loadTodos = useCallback(async () => {
    const s = stateRef.current
    if (!s.dbPath) return
    try {
      const todos = sortTodosForDisplay(await api.todoList(s.dbPath))
      setState(prev => ({ ...prev, todos }))
    } catch (e) {
      setState(prev => ({ ...prev, error: String(e) }))
    }
  }, [])

  const workTags = useCallback((): Tag[] => {
    const s = stateRef.current
    if (!s.config) return []
    return s.config.tags
  }, [])

  const currentTag = useCallback((): Tag | null => {
    const tags = workTags()
    const s = stateRef.current
    return tags[s.tagIdx] ?? null
  }, [workTags])

  const cycleTag = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const tags = prev.config?.tags ?? []
      if (tags.length === 0) return prev
      const next = ((prev.tagIdx + dir) + tags.length) % tags.length
      return { ...prev, tagIdx: next }
    })
  }, [])

  const setTagIdx = useCallback((idx: number) => {
    setState(prev => ({ ...prev, tagIdx: idx }))
  }, [])

  const cycleFilter = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const keys = [null, ...prev.filterKeys]
      const currentIdx = keys.indexOf(prev.logFilter)
      const next = ((currentIdx + dir) + keys.length) % keys.length
      return { ...prev, logFilter: keys[next] ?? null }
    })
  }, [])

  const setFilter = useCallback((key: string | null) => {
    setState(prev => ({ ...prev, logFilter: key }))
  }, [])

  const setDisplayedEntry = useCallback((id: number | null) => {
    setState(prev => ({ ...prev, displayedEntryId: id }))
  }, [])

  const setTodoIdx = useCallback((idx: number) => {
    setState(prev => {
      const clipped = Math.max(0, Math.min(idx, prev.todos.length - 1))
      return { ...prev, todoIdx: clipped }
    })
  }, [])

  const moveTodoIdx = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const next = Math.max(0, Math.min(prev.todoIdx + dir, prev.todos.length - 1))
      return { ...prev, todoIdx: next }
    })
  }, [])

  const moveLogIdx = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const filtered = prev.logFilter
        ? prev.logEntries.filter(e => e.tag_key === prev.logFilter)
        : prev.logEntries
      if (filtered.length === 0) return prev
      const curIdx = filtered.findIndex(e => e.id === prev.displayedEntryId)
      const nextIdx = Math.max(0, Math.min(curIdx + dir, filtered.length - 1))
      return { ...prev, displayedEntryId: filtered[nextIdx].id }
    })
  }, [])

  const setActivePanel = useCallback((panel: ActivePanel) => {
    setState(prev => ({ ...prev, activePanel: panel }))
  }, [])

  const cyclePanel = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const panels: ActivePanel[] = ['log', 'content', 'todo'].filter(p => {
        if (p === 'content') return prev.contentVisible
        if (p === 'todo') return prev.todoVisible
        return true
      }) as ActivePanel[]
      const cur = panels.indexOf(prev.activePanel)
      const next = ((cur + dir) + panels.length) % panels.length
      return { ...prev, activePanel: panels[next] }
    })
  }, [])

  const setContentVisible = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, contentVisible: v }))
  }, [])

  const setTodoVisible = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, todoVisible: v }))
  }, [])

  const setDialogOpen = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, dialogOpen: v }))
  }, [])

  const setInputFocused = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, inputFocused: v }))
  }, [])

  const setConfig = useCallback((config: AppConfig) => {
    setState(prev => {
      const clampedTagIdx = Math.min(prev.tagIdx, Math.max(0, config.tags.length - 1))
      return { ...prev, config, tagIdx: clampedTagIdx }
    })
  }, [])

  // Bootstrap: load config on mount
  useEffect(() => {
    api.getConfig().then(async config => {
      await api.initDb(config.db_path)
      setState(prev => ({ ...prev, config, dbPath: config.db_path }))
    }).catch(e => {
      setState(prev => ({ ...prev, error: String(e) }))
    })
  }, [])

  // Load data when dbPath is set
  useEffect(() => {
    if (state.dbPath) {
      loadAll()
    }
  }, [state.dbPath, loadAll])

  return {
    ...state,
    loadAll,
    loadLog,
    loadTodos,
    workTags,
    currentTag,
    cycleTag,
    cycleFilter,
    setFilter,
    setDisplayedEntry,
    setTodoIdx,
    moveTodoIdx,
    moveLogIdx,
    setActivePanel,
    cyclePanel,
    setContentVisible,
    setTodoVisible,
    setDialogOpen,
    setInputFocused,
    setConfig,
    setTagIdx,
  }
}

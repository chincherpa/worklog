import { useCallback, useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { exit } from '@tauri-apps/plugin-process'
import { useAppState } from './useAppState'
import { getAction } from './keybindings'
import { api } from './lib/invoke'
import { BG_BASE } from './theme'
import LogPanel from './components/panels/LogPanel'
import ContentPanel from './components/panels/ContentPanel'
import TodoPanel from './components/panels/TodoPanel'
import ConfirmDialog from './components/dialogs/ConfirmDialog'
import NewTodoDialog from './components/dialogs/NewTodoDialog'
import ContentEditDialog from './components/dialogs/ContentEditDialog'
import TagSelectDialog from './components/dialogs/TagSelectDialog'
import FocusDialog from './components/dialogs/FocusDialog'
import DebriefingDialog from './components/dialogs/DebriefingDialog'
import TodoDetailDialog from './components/dialogs/TodoDetailDialog'
import WeeklyReviewDialog from './components/dialogs/WeeklyReviewDialog'
import KeybindingsHelpDialog from './components/dialogs/KeybindingsHelpDialog'
import ConfigDialog from './components/dialogs/ConfigDialog'
import Toast, { useToast } from './components/widgets/Toast'
import type { NewTodoResult } from './components/dialogs/NewTodoDialog'
import type { FocusOutcome, FocusResult } from './components/dialogs/FocusDialog'
import type { DebriefResult } from './components/dialogs/DebriefingDialog'
import type { Tag } from './types'

type DialogType =
  | 'none' | 'confirm' | 'newTodo' | 'contentEdit'
  | 'tagSelect' | 'focus' | 'debrief' | 'todoDetail'
  | 'weekly' | 'help' | 'config'

interface DialogData {
  type: DialogType
  confirmMessage?: string
  onConfirm?: () => void
  debriefOutcome?: FocusOutcome
  debriefDurationS?: number
}

export default function App() {
  const app = useAppState()
  const { toasts, showToast, dismiss } = useToast()
  const [dialog, setDialog] = useState<DialogData>({ type: 'none' })
  const focusInputRef = useRef<(() => void) | null>(null)

  // Block/unblock global keys based on dialog
  useEffect(() => {
    app.setDialogOpen(dialog.type !== 'none')
  }, [dialog.type])

  // Git progress toasts
  useEffect(() => {
    const unlisten = listen<string>('git://progress', e => {
      showToast(e.payload, 'info')
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const openDialog = useCallback((d: DialogData) => {
    setDialog(d)
  }, [])

  const closeDialog = useCallback(() => {
    setDialog({ type: 'none' })
  }, [])

  // Global keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in dialog inputs — dialogs handle their own keys
      if (app.dialogOpen) return

      // Shift+Tab special: cycle panel back or cycle tag back
      if (e.key === 'Tab' && !e.shiftKey && app.inputFocused) {
        e.preventDefault()
        app.cycleTag(1)
        return
      }
      if (e.key === 'Tab' && e.shiftKey && app.inputFocused) {
        e.preventDefault()
        app.cycleTag(-1)
        return
      }
      // Don't intercept text input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          target.blur()
          app.setInputFocused(false)
        }
        return
      }

      const action = getAction(e)
      if (!action) return
      e.preventDefault()
      handleAction(action)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [app.dialogOpen, app.inputFocused, app, dialog])

  const handleAction = useCallback(async (action: string) => {
    const { dbPath, todos, todoIdx, displayedEntryId, logEntries, activeSession, config } = app

    switch (action) {
      case 'focusLogInput':
        app.setActivePanel('log')
        setTimeout(() => focusInputRef.current?.(), 0)
        break

      case 'quit':
        await exit(0)
        break

      case 'refreshAll':
        await app.loadAll()
        showToast('Neu geladen', 'success')
        break

      case 'arrowUp':
        if (app.activePanel === 'todo') app.moveTodoIdx(-1)
        else app.moveLogIdx(-1)
        break

      case 'arrowDown':
        if (app.activePanel === 'todo') app.moveTodoIdx(1)
        else app.moveLogIdx(1)
        break

      case 'cyclePanel':
        app.cyclePanel(1)
        break

      case 'cyclePanelBack':
        app.cyclePanel(-1)
        break

      case 'toggleContent':
        app.setContentVisible(!app.contentVisible)
        break

      case 'toggleTodo':
        app.setTodoVisible(!app.todoVisible)
        break

      case 'nextFilter':
        app.cycleFilter(1)
        break

      case 'prevFilter':
        app.cycleFilter(-1)
        break

      case 'prevTag':
        app.cycleTag(-1)
        break

      case 'viewLatest':
        if (logEntries.length > 0) {
          app.setDisplayedEntry(logEntries[0].id)
          app.setActivePanel('log')
        }
        break

      case 'addTodo':
        openDialog({ type: 'newTodo' })
        break

      case 'todoDetail': {
        const todo = todos[todoIdx]
        if (todo) openDialog({ type: 'todoDetail' })
        break
      }

      case 'todoActivate': {
        const todo = todos[todoIdx]
        if (!todo || !dbPath) break
        const newStatus = todo.status === 'active' ? 'paused' : 'active'
        await api.todoSetStatus(dbPath, todo.id, newStatus)
        await app.loadTodos()
        break
      }

      case 'todoDone': {
        const todo = todos[todoIdx]
        if (!todo || !dbPath) break
        await api.todoSetStatus(dbPath, todo.id, 'done')
        const tags = config?.tags ?? []
        const doneTag = tags.find(t => t.key === 'done')
        if (doneTag) await api.logAdd(dbPath, 'done', todo.title)
        await app.loadAll()
        showToast(`${todo.title.slice(0, 30)} erledigt`, 'success')
        break
      }

      case 'cancelTodo': {
        const todo = todos[todoIdx]
        if (!todo) break
        openDialog({
          type: 'confirm',
          confirmMessage: `Todo abbrechen: "${todo.title.slice(0, 40)}"?`,
          onConfirm: async () => {
            await api.todoSetStatus(dbPath, todo.id, 'cancelled')
            await app.loadTodos()
            closeDialog()
            showToast('Todo abgebrochen', 'warning')
          },
        })
        break
      }

      case 'editEntry': {
        const entry = logEntries.find(e => e.id === displayedEntryId)
        if (entry) openDialog({ type: 'contentEdit' })
        break
      }

      case 'changeTag': {
        const entry = logEntries.find(e => e.id === displayedEntryId)
        if (entry) openDialog({ type: 'tagSelect' })
        break
      }

      case 'deleteEntry': {
        const entry = logEntries.find(e => e.id === displayedEntryId)
        if (!entry) break
        openDialog({
          type: 'confirm',
          confirmMessage: `Eintrag löschen: "${entry.content.slice(0, 40)}"?`,
          onConfirm: async () => {
            await api.logDelete(dbPath, entry.id)
            await app.loadLog()
            closeDialog()
            showToast('Eintrag gelöscht', 'warning')
          },
        })
        break
      }

      case 'startFocus': {
        const todo = todos[todoIdx]
        if (!todo || !dbPath) break
        if (activeSession && activeSession.todo_id === todo.id && !activeSession.ended_at) {
          // Reopen existing session dialog
          openDialog({ type: 'focus' })
        } else if (!activeSession || activeSession.ended_at) {
          // Start new session
          await api.sessionStart(dbPath, todo.id)
          await app.loadAll()
          openDialog({ type: 'focus' })
        }
        break
      }

      case 'openWeekly':
        openDialog({ type: 'weekly' })
        break

      case 'openHelp':
        openDialog({ type: 'help' })
        break

      case 'openConfig':
        openDialog({ type: 'config' })
        break
    }
  }, [app, dialog, openDialog, closeDialog, showToast])

  // Dialog result handlers
  const handleNewTodo = useCallback(async (result: NewTodoResult | null) => {
    closeDialog()
    if (!result || !app.dbPath) return
    await api.todoAdd(app.dbPath, result.title, result.context || undefined, result.priority)
    await app.loadTodos()
    showToast(`Todo erstellt: ${result.title.slice(0, 30)}`, 'success')
  }, [app, closeDialog, showToast])

  const handleContentEdit = useCallback(async (result: string | null) => {
    closeDialog()
    if (!result || !app.dbPath || !app.displayedEntryId) return
    await api.logUpdate(app.dbPath, app.displayedEntryId, result)
    await app.loadLog()
  }, [app, closeDialog])

  const handleTagSelect = useCallback(async (key: string | null) => {
    closeDialog()
    if (!key || !app.dbPath || !app.displayedEntryId) return
    await api.logUpdate(app.dbPath, app.displayedEntryId, undefined, key)
    await app.loadLog()
  }, [app, closeDialog])

  const handleFocusResult = useCallback(async (result: FocusResult) => {
    if (result.action === 'minimize') {
      closeDialog()
      return
    }
    // End session → show debriefing
    closeDialog()
    openDialog({
      type: 'debrief',
      debriefOutcome: result.outcome as FocusOutcome,
      debriefDurationS: result.elapsed_s,
    })
  }, [closeDialog, openDialog])

  const handleDebriefResult = useCallback(async (result: DebriefResult | null) => {
    closeDialog()
    if (!app.dbPath || !app.activeSession) return
    const outcome = result?.outcome ?? dialog.debriefOutcome ?? 'open'
    await api.sessionEnd(app.dbPath, app.activeSession.id, outcome, result?.log_entry)
    if (result?.log_entry && app.todos[app.todoIdx]) {
      const todo = app.todos[app.todoIdx]
      const tagKey = outcome === 'solved' ? 'done' : outcome === 'blocked' ? 'block' : 'note'
      await api.logAdd(app.dbPath, tagKey, result.log_entry, 'work', todo.id)
    }
    await app.loadAll()
    showToast('Session beendet', 'info')
  }, [app, dialog, closeDialog, showToast])

  const handleConfigSave = useCallback(async (tags: Tag[]) => {
    if (!app.config) return
    try {
      await api.saveTags(app.config.config_path, tags)
      const newConfig = await api.getConfig(app.config.config_path)
      app.setConfig(newConfig)
      closeDialog()
      showToast('Tags gespeichert', 'success')
    } catch (e) {
      showToast(String(e), 'error')
    }
  }, [app, closeDialog, showToast])

  const handleLogSubmit = useCallback(async (text: string) => {
    if (!app.dbPath || !app.currentTag()) return
    const tag = app.currentTag()!
    try {
      await api.logAdd(app.dbPath, tag.key, text)
      await app.loadLog()
    } catch (e) {
      showToast(String(e), 'error')
    }
  }, [app, showToast])

  const displayedEntry = app.logEntries.find(e => e.id === app.displayedEntryId)
  const selectedTodo = app.todos[app.todoIdx] ?? null
  const allTags = app.config?.tags ?? []

  if (app.error && !app.config) {
    return (
      <div style={{
        background: BG_BASE,
        color: '#FF6B6B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        fontFamily: 'monospace',
        fontSize: 13,
        textAlign: 'center',
      }}>
        <div>⚠ Konfigurationsfehler</div>
        <div style={{ color: '#888', maxWidth: 400 }}>{app.error}</div>
        <div style={{ color: '#555', fontSize: 11 }}>
          Erstelle config.toml unter {'{'}cwd{'}'}/config.toml oder ~/.config/worklog/config.toml
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      width: '100vw',
      height: '100vh',
      background: BG_BASE,
      gap: 8,
      padding: 8,
      overflow: 'hidden',
    }}>
      <LogPanel
        logEntries={app.logEntries}
        filterKeys={app.filterKeys}
        logFilter={app.logFilter}
        displayedEntryId={app.displayedEntryId}
        carryOver={app.carryOver}
        currentTag={app.currentTag()}
        config={app.config}
        isActive={app.activePanel === 'log'}
        inputFocused={app.inputFocused}
        onEntrySelect={id => {
          app.setDisplayedEntry(id)
          app.setActivePanel('log')
        }}
        onLogSubmit={handleLogSubmit}
        onFilterChange={app.setFilter}
        onInputFocus={app.setInputFocused}
        onOpenHelp={() => openDialog({ type: 'help' })}
        focusInputRef={focusInputRef}
      />

      {app.contentVisible && (
        <ContentPanel
          entries={app.logEntries}
          displayedEntryId={app.displayedEntryId}
          config={app.config}
          isActive={app.activePanel === 'content'}
        />
      )}

      {app.todoVisible && (
        <TodoPanel
          todos={app.todos}
          todoIdx={app.todoIdx}
          activeSession={app.activeSession}
          dbPath={app.dbPath}
          config={app.config}
          isActive={app.activePanel === 'todo'}
          logEntries={app.logEntries}
          onTodoSelect={idx => {
            app.setTodoIdx(idx)
            app.setActivePanel('todo')
          }}
        />
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={dialog.type === 'confirm'}
        message={dialog.confirmMessage ?? ''}
        onClose={confirmed => {
          if (confirmed) dialog.onConfirm?.()
          else closeDialog()
        }}
      />

      <NewTodoDialog
        open={dialog.type === 'newTodo'}
        onClose={handleNewTodo}
      />

      <ContentEditDialog
        open={dialog.type === 'contentEdit'}
        initialContent={displayedEntry?.content ?? ''}
        onClose={handleContentEdit}
      />

      <TagSelectDialog
        open={dialog.type === 'tagSelect'}
        tags={allTags}
        currentKey={displayedEntry?.tag_key ?? null}
        onClose={handleTagSelect}
      />

      <FocusDialog
        open={dialog.type === 'focus'}
        todo={selectedTodo}
        session={app.activeSession}
        dbPath={app.dbPath}
        onClose={handleFocusResult}
      />

      <DebriefingDialog
        open={dialog.type === 'debrief'}
        todo={selectedTodo}
        durationS={dialog.debriefDurationS ?? 0}
        initialOutcome={dialog.debriefOutcome}
        onClose={handleDebriefResult}
      />

      <TodoDetailDialog
        open={dialog.type === 'todoDetail'}
        todo={selectedTodo}
        dbPath={app.dbPath}
        onClose={closeDialog}
      />

      <WeeklyReviewDialog
        open={dialog.type === 'weekly'}
        dbPath={app.dbPath}
        todos={app.todos}
        onClose={closeDialog}
      />

      <KeybindingsHelpDialog
        open={dialog.type === 'help'}
        onClose={closeDialog}
      />

      <ConfigDialog
        open={dialog.type === 'config'}
        tags={allTags}
        onSave={handleConfigSave}
        onClose={closeDialog}
      />

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

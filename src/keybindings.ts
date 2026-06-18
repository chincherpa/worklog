export type ActionName =
  | 'focusLogInput'
  | 'addTodo'
  | 'todoDone'
  | 'deleteEntry'
  | 'cancelTodo'
  | 'startFocus'
  | 'editEntry'
  | 'changeTag'
  | 'refreshAll'
  | 'quit'
  | 'toggleContent'
  | 'toggleTodo'
  | 'openWeekly'
  | 'viewLatest'
  | 'todoActivate'
  | 'todoDetail'
  | 'arrowUp'
  | 'arrowDown'
  | 'todoMoveUp'
  | 'todoMoveDown'
  | 'cyclePanel'
  | 'cyclePanelBack'
  | 'nextTagFilter'
  | 'prevTagFilter'
  | 'nextProjectFilter'
  | 'prevProjectFilter'
  | 'prevTag'
  | 'nextTag'
  | 'cycleProject'
  | 'openHelp'
  | 'openConfig'
  | 'openGantt'
  | 'focusSearch'

/** Build the canonical key string for a keyboard event (e.g. "Shift+D", "Control+f"). */
export function keyStr(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey && e.key !== 'Control') parts.push('Control')
  if (e.shiftKey && e.key !== 'Shift') parts.push('Shift')
  parts.push(e.key)
  return parts.join('+')
}

/** Human-readable labels per action — single source of truth for editor + help. */
export const ACTION_LABELS: Record<ActionName, string> = {
  focusLogInput: 'Focus log input',
  addTodo: 'New todo',
  todoDone: 'Mark todo done',
  deleteEntry: 'Delete log entry',
  cancelTodo: 'Cancel todo (confirm)',
  startFocus: 'Start / Stop focus session',
  editEntry: 'Edit entry',
  changeTag: 'Change entry tag',
  refreshAll: 'Reload all',
  quit: 'Quit',
  toggleContent: 'Toggle content panel',
  toggleTodo: 'Toggle todo panel',
  openWeekly: 'Weekly review',
  viewLatest: 'Jump to latest entry',
  todoActivate: 'Todo active / paused',
  todoDetail: 'Open todo detail',
  arrowUp: 'Navigate up',
  arrowDown: 'Navigate down',
  todoMoveUp: 'Move todo up',
  todoMoveDown: 'Move todo down',
  cyclePanel: 'Next panel',
  cyclePanelBack: 'Previous panel',
  nextTagFilter: 'Next tag filter',
  prevTagFilter: 'Previous tag filter',
  nextProjectFilter: 'Next project filter',
  prevProjectFilter: 'Previous project filter',
  prevTag: 'Previous tag (input)',
  nextTag: 'Cycle tag',
  cycleProject: 'Cycle active project',
  openHelp: 'Show this help',
  openConfig: 'Manage config (tags / projects / keys)',
  openGantt: 'Zeitplan (Gantt)',
  focusSearch: 'Focus search',
}

/** All actions in display order (drives the editor and help listing). */
export const ALL_ACTIONS = Object.keys(ACTION_LABELS) as ActionName[]

export const DEFAULT_BINDINGS: Record<string, ActionName> = {
  ' ': 'todoActivate',
  'Control+f': 'focusSearch',
  'Control+F': 'focusSearch',
  '?': 'openHelp',
  'Shift+D': 'deleteEntry',
  'Shift+I': 'prevProjectFilter',
  'Shift+O': 'nextTag',
  'Shift+Tab': 'cyclePanelBack',
  a: 'addTodo',
  A: 'addTodo',
  ArrowDown: 'arrowDown',
  ArrowUp: 'arrowUp',
  'Shift+ArrowUp': 'todoMoveUp',
  'Shift+ArrowDown': 'todoMoveDown',
  'Shift+J': 'prevTagFilter',
  c: 'changeTag',
  C: 'changeTag',
  d: 'todoDone',
  e: 'editEntry',
  E: 'editEntry',
  Enter: 'todoDetail',
  f: 'startFocus',
  F: 'startFocus',
  g: 'openConfig',
  G: 'openConfig',
  i: 'nextProjectFilter',
  l: 'focusLogInput',
  L: 'focusLogInput',
  m: 'toggleContent',
  M: 'toggleContent',
  j: 'nextTagFilter',
  o: 'cycleProject',
  O: 'cycleProject',
  p: 'prevTag',
  P: 'prevTag',
  q: 'quit',
  Q: 'quit',
  r: 'refreshAll',
  R: 'refreshAll',
  t: 'toggleTodo',
  T: 'toggleTodo',
  Tab: 'cyclePanel',
  v: 'viewLatest',
  V: 'viewLatest',
  w: 'openWeekly',
  W: 'openWeekly',
  x: 'cancelTodo',
  X: 'cancelTodo',
  z: 'openGantt',
  Z: 'openGantt',
}

/** Active runtime bindings (key→action). Replaced via setBindings() once config loads. */
let activeBindings: Record<string, ActionName> = { ...DEFAULT_BINDINGS }

export function setBindings(map: Record<string, ActionName>): void {
  activeBindings = map
}

export function getAction(e: KeyboardEvent): ActionName | null {
  const key = keyStr(e)
  return activeBindings[key] ?? null
}

/** Current active key→action map (used by the help dialog to render live bindings). */
export function getActiveBindings(): Record<string, ActionName> {
  return activeBindings
}

/** Invert a key→action map into action→keys[] (preserving multiple keys per action). */
export function bindingsToPerAction(map: Record<string, ActionName>): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [key, action] of Object.entries(map)) {
    ;(out[action] ??= []).push(key)
  }
  return out
}

/** Default keys per action, used as fallback for any action the config doesn't override. */
export const DEFAULT_PER_ACTION = bindingsToPerAction(DEFAULT_BINDINGS)

/**
 * Build a runtime key→action map from a per-action override map. Actions absent
 * (or with an empty key list) fall back to their default keys.
 */
export function buildBindings(perAction: Record<string, string[]>): Record<string, ActionName> {
  const out: Record<string, ActionName> = {}
  for (const action of ALL_ACTIONS) {
    const keys = perAction[action]?.length ? perAction[action] : DEFAULT_PER_ACTION[action] ?? []
    for (const key of keys) out[key] = action
  }
  return out
}

/** Convert the config-shaped Keybinding[] into a per-action record. */
export function keybindingListToPerAction(list: { action: string; keys: string[] }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const kb of list) {
    if (kb.keys.length) out[kb.action] = [...kb.keys]
  }
  return out
}

/**
 * For a freshly captured single lowercase letter, also register its uppercase
 * variant (matches the historical a/A scheme so CapsLock keeps working).
 */
export function withCaseVariant(key: string): string[] {
  if (key.length === 1 && key >= 'a' && key <= 'z') return [key, key.toUpperCase()]
  return [key]
}

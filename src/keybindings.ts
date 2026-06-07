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
  | 'cyclePanel'
  | 'cyclePanelBack'
  | 'nextFilter'
  | 'prevFilter'
  | 'prevTag'
  | 'cycleProject'
  | 'openHelp'
  | 'openConfig'

function keyStr(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.shiftKey && e.key !== 'Shift') parts.push('Shift')
  parts.push(e.key)
  return parts.join('+')
}

const BINDINGS: Record<string, ActionName> = {
  l: 'focusLogInput',
  L: 'focusLogInput',
  a: 'addTodo',
  A: 'addTodo',
  d: 'todoDone',
  'Shift+D': 'deleteEntry',
  x: 'cancelTodo',
  X: 'cancelTodo',
  f: 'startFocus',
  F: 'startFocus',
  e: 'editEntry',
  E: 'editEntry',
  c: 'changeTag',
  C: 'changeTag',
  r: 'refreshAll',
  R: 'refreshAll',
  q: 'quit',
  Q: 'quit',
  m: 'toggleContent',
  M: 'toggleContent',
  t: 'toggleTodo',
  T: 'toggleTodo',
  w: 'openWeekly',
  W: 'openWeekly',
  v: 'viewLatest',
  V: 'viewLatest',
  ' ': 'todoActivate',
  Enter: 'todoDetail',
  ArrowUp: 'arrowUp',
  ArrowDown: 'arrowDown',
  k: 'arrowUp',
  j: 'arrowDown',
  Tab: 'cyclePanel',
  'Shift+Tab': 'cyclePanelBack',
  n: 'nextFilter',
  N: 'nextFilter',
  b: 'prevFilter',
  B: 'prevFilter',
  p: 'prevTag',
  P: 'prevTag',
  o: 'cycleProject',
  O: 'cycleProject',
  '?': 'openHelp',
  g: 'openConfig',
  G: 'openConfig',
}

export function getAction(e: KeyboardEvent): ActionName | null {
  const key = keyStr(e)
  return BINDINGS[key] ?? null
}

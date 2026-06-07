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
  | 'nextProjectFilter'
  | 'prevProjectFilter'
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
  ' ': 'todoActivate',
  '?': 'openHelp',
  'Shift+D': 'deleteEntry',
  'Shift+I': 'prevProjectFilter',
  'Shift+Tab': 'cyclePanelBack',
  a: 'addTodo',
  A: 'addTodo',
  ArrowDown: 'arrowDown',
  ArrowUp: 'arrowUp',
  b: 'prevFilter',
  B: 'prevFilter',
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
  j: 'arrowDown',
  k: 'arrowUp',
  l: 'focusLogInput',
  L: 'focusLogInput',
  m: 'toggleContent',
  M: 'toggleContent',
  n: 'nextFilter',
  N: 'nextFilter',
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
}

export function getAction(e: KeyboardEvent): ActionName | null {
  const key = keyStr(e)
  return BINDINGS[key] ?? null
}

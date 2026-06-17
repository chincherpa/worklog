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
  | 'nextFilter'
  | 'prevFilter'
  | 'nextProjectFilter'
  | 'prevProjectFilter'
  | 'prevTag'
  | 'nextTag'
  | 'cycleProject'
  | 'openHelp'
  | 'openConfig'
  | 'focusSearch'

function keyStr(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey && e.key !== 'Control') parts.push('Control')
  if (e.shiftKey && e.key !== 'Shift') parts.push('Shift')
  parts.push(e.key)
  return parts.join('+')
}

const BINDINGS: Record<string, ActionName> = {
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

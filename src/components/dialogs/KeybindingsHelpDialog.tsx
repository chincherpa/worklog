import { useEffect } from 'react'
import { BG_PANEL, BORDER_NORMAL, TEXT_DIM, TEXT_PRIMARY, TEXT_SECONDARY } from '../../theme'
import { Overlay } from './ConfirmDialog'
import { ALL_ACTIONS, ACTION_LABELS, bindingsToPerAction, getActiveBindings } from '../../keybindings'

interface Props {
  open: boolean
  onClose: () => void
}

/** Make a raw key string presentable (e.g. "Shift+ArrowUp" → "Shift+↑", " " → "Space"). */
function prettyKey(key: string): string {
  return key
    .split('+')
    .map(part => {
      switch (part) {
        case 'ArrowUp': return '↑'
        case 'ArrowDown': return '↓'
        case 'ArrowLeft': return '←'
        case 'ArrowRight': return '→'
        case ' ': return 'Space'
        case 'Control': return 'Ctrl'
        default: return part
      }
    })
    .join('+')
}

export default function KeybindingsHelpDialog({ open, onClose }: Props) {
  // Build rows live from the active bindings so user edits are reflected immediately.
  const perAction = bindingsToPerAction(getActiveBindings())
  const BINDINGS: [string, string][] = ALL_ACTIONS
    .map(action => {
      const keys = perAction[action] ?? []
      if (keys.length === 0) return null
      return [keys.map(prettyKey).join(' / '), ACTION_LABELS[action]] as [string, string]
    })
    .filter((r): r is [string, string] => r !== null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <Overlay>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_NORMAL}`,
        borderRadius: 6,
        width: 460,
        maxHeight: 500,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${BORDER_NORMAL}`,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 600 }}>
            ⌨ Keyboard Shortcuts
          </div>
          <button onClick={onClose} style={{
            padding: '5px 14px',
            border: `1px solid ${BORDER_NORMAL}`,
            borderRadius: 4,
            background: 'transparent',
            color: TEXT_DIM,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
          }}>
            Close (Esc)
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {BINDINGS.map(([key, desc]) => (
              <tr key={key}>
                <td style={{ padding: '3px 12px 3px 0', whiteSpace: 'nowrap' }}>
                  <code style={{
                    background: '#1a2030',
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 11,
                    color: TEXT_PRIMARY,
                  }}>
                    {key}
                  </code>
                </td>
                <td style={{ padding: '3px 0', fontSize: 12, color: TEXT_SECONDARY }}>
                  {desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </Overlay>
  )
}

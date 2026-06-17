import { useEffect } from 'react'
import { BG_PANEL, BORDER_NORMAL, TEXT_DIM, TEXT_PRIMARY, TEXT_SECONDARY } from '../../theme'
import { Overlay } from './ConfirmDialog'

interface Props {
  open: boolean
  onClose: () => void
}

const BINDINGS = [
  ['↑', 'Navigate up'],
  ['↓', 'Navigate down'],
  ['Shift+↑', 'Move todo up'],
  ['Shift+↓', 'Move todo down'],
  ['A', 'New todo'],
  ['B', 'Previous filter'],
  ['C', 'Change entry tag'],
  ['D', 'Mark todo done'],
  ['E', 'Edit entry'],
  ['F', 'Start / Stop focus session'],
  ['G', 'Manage tags (config)'],
  ['I', 'Next project filter'],
  ['L', 'Focus log input'],
  ['N', 'Next filter'],
  ['O', 'Cycle active project'],
  ['P', 'Previous tag (input)'],
  ['R', 'Reload all'],
  ['M', 'Toggle content panel'],
  ['T', 'Toggle todo panel'],
  ['V', 'Jump to latest entry'],
  ['W', 'Weekly review'],
  ['X', 'Cancel todo (confirm)'],
  ['Q', 'Quit'],
  ['Enter', 'Open todo detail'],
  ['Tab', 'Next panel'],
  ['Shift+D', 'Delete log entry'],
  ['Shift+I', 'Previous project filter'],
  ['Shift+O', 'Cycle tag'],
  ['Shift+Tab', 'Previous panel'],
  ['Space', 'Todo active/paused'],
  ['?', 'This help'],
]

export default function KeybindingsHelpDialog({ open, onClose }: Props) {
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

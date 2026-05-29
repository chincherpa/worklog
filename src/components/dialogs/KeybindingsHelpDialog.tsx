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
  ['A', 'New todo'],
  ['B', 'Previous filter'],
  ['C', 'Change entry tag'],
  ['D', 'Mark todo done'],
  ['E', 'Edit entry'],
  ['Enter', 'Open todo detail'],
  ['F', 'Start / stop focus session'],
  ['L', 'Focus log input'],
  ['M', 'Toggle content panel'],
  ['N', 'Next filter'],
  ['P', 'Previous tag (input)'],
  ['Q', 'Quit'],
  ['R', 'Reload all'],
  ['Shift+D', 'Delete log entry'],
  ['Shift+Tab', 'Previous panel'],
  ['Space', 'Todo active/paused'],
  ['T', 'Toggle todo panel'],
  ['Tab', 'Next panel'],
  ['W', 'Weekly review'],
  ['X', 'Cancel todo (confirm)'],
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
        padding: 20,
        width: 460,
        maxHeight: 500,
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 13, color: TEXT_PRIMARY, marginBottom: 12, fontWeight: 600 }}>
          ⌨ Keyboard Shortcuts
        </div>
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
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
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
      </div>
    </Overlay>
  )
}

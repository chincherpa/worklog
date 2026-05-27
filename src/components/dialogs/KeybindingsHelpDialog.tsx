import { useEffect } from 'react'
import { BG_PANEL, BORDER_NORMAL, TEXT_DIM, TEXT_PRIMARY, TEXT_SECONDARY } from '../../theme'
import { Overlay } from './ConfirmDialog'

interface Props {
  open: boolean
  onClose: () => void
}

const BINDINGS = [
  ['L', 'Log-Eingabe fokussieren'],
  ['A', 'Neues Todo'],
  ['D', 'Todo erledigt'],
  ['Shift+D', 'Log-Eintrag löschen'],
  ['X', 'Todo abbrechen (Bestätigung)'],
  ['F', 'Focus-Session starten / beenden'],
  ['E', 'Eintrag bearbeiten'],
  ['C', 'Tag des Eintrags ändern'],
  ['R', 'Alles neu laden'],
  ['Q', 'Beenden'],
  ['M', 'Content-Panel ein/aus'],
  ['T', 'Todo-Panel ein/aus'],
  ['W', 'Wochenrückblick'],
  ['V', 'Neuesten Eintrag anzeigen'],
  ['Space', 'Todo aktiv/pausiert'],
  ['Enter', 'Todo-Detail öffnen'],
  ['↑ / K', 'Navigation hoch'],
  ['↓ / J', 'Navigation runter'],
  ['Tab', 'Nächstes Panel'],
  ['Shift+Tab', 'Vorheriges Panel'],
  ['N', 'Nächster Filter'],
  ['B', 'Vorheriger Filter'],
  ['P', 'Vorheriger Tag (Eingabe)'],
  ['?', 'Diese Hilfe'],
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
          ⌨ Tastenkürzel
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
            Schließen (Esc)
          </button>
        </div>
      </div>
    </Overlay>
  )
}

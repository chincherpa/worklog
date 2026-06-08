import type { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BG_PANEL, BORDER_NORMAL, BORDER_ACTIVE, TEXT_DIM, TEXT_PRIMARY, TEXT_SECONDARY } from '../../theme'
import type { AppConfig, LogEntry } from '../../types'

interface Props {
  entries: LogEntry[]
  displayedEntryId: number | null
  config: AppConfig | null
  isActive: boolean
  style?: CSSProperties
}

export default function ContentPanel({ entries, displayedEntryId, config, isActive, style }: Props) {
  const tags = config?.tags ?? []
  const tagMap = new Map(tags.map(t => [t.key, t]))
  const projects = config?.projects ?? []
  const projectMap = new Map(projects.map(p => [p.key, p]))
  const entry = entries.find(e => e.id === displayedEntryId)
  const tag = entry ? tagMap.get(entry.tag_key) : undefined
  const project = entry ? projectMap.get(entry.project) : undefined

  const lines = entry?.content.split('\n') ?? []
  const heading = lines[0] ?? ''
  const body = lines.slice(1).join('\n').trim()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: BG_PANEL,
      border: `${isActive ? 2 : 1}px solid ${isActive ? BORDER_ACTIVE : BORDER_NORMAL}`,
      borderRadius: 4,
      overflow: 'hidden',
      flex: 1,
      minWidth: 0,
      ...style,
    }}>
      {/* Title */}
      <div style={{
        padding: '6px 10px',
        borderBottom: `1px solid ${BORDER_NORMAL}`,
        fontSize: 12,
        color: TEXT_SECONDARY,
        flexShrink: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {entry && tag ? (
          <>
            📄{' '}
            {project && (
              <>
                <span style={{ color: project.color }}>{project.symbol} {project.key}</span>
                {' · '}
              </>
            )}
            <span style={{ color: tag.color }}>{tag.symbol} {tag.key}</span>
            {' · '}
            {entry.created_at.slice(0, 16)}
          </>
        ) : '📄 CONTENT'}
      </div>

      {/* Content */}
      <div className="scroll-container selectable" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
      }}>
        {entry ? (
          <>
            {heading && (
              <h3 style={{
                color: TEXT_PRIMARY,
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
                fontFamily: 'inherit',
              }}>
                {heading}
              </h3>
            )}
            {heading && body && (
              <hr style={{ border: 'none', borderTop: `1px solid ${BORDER_NORMAL}`, margin: '8px 0' }} />
            )}
            {body && (
              <div style={{ color: TEXT_PRIMARY, fontSize: 13, lineHeight: 1.6 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p style={{ marginBottom: 8 }}>{children}</p>,
                    code: ({ children }) => (
                      <code style={{
                        background: '#1a2030',
                        padding: '1px 4px',
                        borderRadius: 3,
                        fontFamily: 'monospace',
                        fontSize: 12,
                      }}>
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre style={{
                        background: '#1a2030',
                        padding: '8px 12px',
                        borderRadius: 4,
                        overflow: 'auto',
                        fontSize: 12,
                        marginBottom: 8,
                      }}>
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {body}
                </ReactMarkdown>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: TEXT_DIM, fontSize: 11, textAlign: 'center', marginTop: 32 }}>
            No entry selected
          </div>
        )}
      </div>
    </div>
  )
}

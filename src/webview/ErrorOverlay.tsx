import type { RendererError } from '../shared/message'

// Non-modal error banner per ADR-0009. Sticks to the top of the preview;
// content below stays rendered (PRD §6.4 "last good stays visible").
//
// Visual language is hand-tuned (not OpenUI tokens, not VS Code theme) per
// ADR-0008 — preview chrome must not shift with IDE theme, and OpenUI tokens
// may drift across version bumps. Palette is a calm rose: enough to read as
// "error" without strobing in type-mode (ADR-0003) mid-edit flashes.

const palette = {
  bg: '#fdf3f3',
  border: '#f4d5d5',
  text: '#5a2424',
  chipBg: '#f9e3e3',
  chipText: '#7a1f1f',
  accent: '#a13030',
  buttonBg: '#fff',
  buttonHoverBg: '#fbeaea',
}

const containerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: palette.bg,
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  color: palette.text,
  padding: '8px 10px',
  marginBottom: 12,
  fontFamily: '-apple-system, system-ui, sans-serif',
  fontSize: 13,
  lineHeight: 1.4,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 24,
}

const iconStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: 14,
  lineHeight: 1,
  color: palette.accent,
}

const chipStyle: React.CSSProperties = {
  flexShrink: 0,
  background: palette.chipBg,
  color: palette.chipText,
  padding: '1px 6px',
  borderRadius: 4,
  fontFamily: 'SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  fontWeight: 500,
}

const messageStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const buttonStyle: React.CSSProperties = {
  flexShrink: 0,
  background: palette.buttonBg,
  border: `1px solid ${palette.border}`,
  borderRadius: 4,
  color: palette.text,
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: '6px 0 0 0',
  padding: 0,
  maxHeight: 180,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const headerStyle: React.CSSProperties = {
  ...rowStyle,
  fontWeight: 600,
}

export function ErrorOverlay({
  errors,
  onJumpToLine,
}: {
  errors: RendererError[]
  onJumpToLine: (line: number) => void
}) {
  if (errors.length === 0) return null

  if (errors.length === 1) {
    const e = errors[0]
    return (
      <div style={containerStyle} role="alert">
        <ErrorRow error={e} onJumpToLine={onJumpToLine} />
      </div>
    )
  }

  return (
    <div style={containerStyle} role="alert">
      <div style={headerStyle}>
        <span style={iconStyle}>⚠</span>
        <span>{errors.length} parse errors</span>
      </div>
      <ul style={listStyle}>
        {errors.map(e => (
          <li key={`${e.line ?? '?'}:${e.message}`} style={rowStyle}>
            <span style={{ ...iconStyle, visibility: 'hidden' }}>⚠</span>
            <ErrorRowInner error={e} onJumpToLine={onJumpToLine} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ErrorRow({
  error,
  onJumpToLine,
}: {
  error: RendererError
  onJumpToLine: (line: number) => void
}) {
  return (
    <div style={rowStyle}>
      <span style={iconStyle}>⚠</span>
      <ErrorRowInner error={error} onJumpToLine={onJumpToLine} />
    </div>
  )
}

function ErrorRowInner({
  error,
  onJumpToLine,
}: {
  error: RendererError
  onJumpToLine: (line: number) => void
}) {
  return (
    <>
      {error.line ? <span style={chipStyle}>line {error.line}</span> : null}
      <span style={messageStyle} title={error.message}>
        {error.message}
      </span>
      {error.line ? (
        <button
          type="button"
          style={buttonStyle}
          onClick={() => onJumpToLine(error.line!)}
          onMouseEnter={ev => {
            ;(ev.currentTarget.style.background as string) = palette.buttonHoverBg
          }}
          onMouseLeave={ev => {
            ;(ev.currentTarget.style.background as string) = palette.buttonBg
          }}
        >
          Jump →
        </button>
      ) : null}
    </>
  )
}

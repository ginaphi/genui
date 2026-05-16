import { useEffect, useState } from 'react'
import { openuiRenderer } from '../renderers/openui'
import type { RendererError, ToWebviewMessage } from '../shared/message'
import { ErrorOverlay } from './ErrorOverlay'

// VS Code webview API — injected by the host at runtime.
declare global {
  function acquireVsCodeApi(): {
    postMessage(msg: unknown): void
    setState(state: unknown): void
    getState(): unknown
  }
}

const vscode = acquireVsCodeApi()

// Format registry (ADR-0001). Spike has one entry; commit #2+ adds more formats here.
const RENDERERS = {
  [openuiRenderer.formatId]: openuiRenderer,
} as const

type ViewState = { format: string; content: string; uri: string }

export function App() {
  const [state, setState] = useState<ViewState | null>(null)
  const [errors, setErrors] = useState<RendererError[]>([])

  useEffect(() => {
    const handler = (e: MessageEvent<ToWebviewMessage>) => {
      const msg = e.data
      if (msg.type === 'update') {
        setState({ format: msg.format, content: msg.content, uri: msg.uri })
        vscode.setState({ uri: msg.uri }) // ADR-0012 persistence
      }
    }
    window.addEventListener('message', handler)
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', handler)
  }, [])

  if (!state) return null

  const entry = RENDERERS[state.format as keyof typeof RENDERERS]
  if (!entry) {
    return <div style={{ padding: '1rem' }}>No renderer registered for format: {state.format}</div>
  }

  const FormatRenderer = entry.Renderer
  return (
    <>
      <ErrorOverlay
        errors={errors}
        onJumpToLine={line => {
          vscode.postMessage({ type: 'jumpToLine', uri: state.uri, line })
        }}
      />
      <FormatRenderer
        content={state.content}
        onError={errs => {
          setErrors(errs)
          if (errs.length === 0) {
            vscode.postMessage({
              type: 'rendered',
              uri: state.uri,
              renderedAt: Date.now(),
            })
          } else {
            vscode.postMessage({
              type: 'error',
              uri: state.uri,
              message: errs[0].message,
              line: errs[0].line,
            })
          }
        }}
      />
    </>
  )
}

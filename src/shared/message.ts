// Message protocol per ADR-0009.

export type RendererError = {
  message: string
  line?: number
}

export type ToWebviewMessage = {
  type: 'update'
  format: string
  content: string
  filename: string
  uri: string
}

export type FromWebviewMessage =
  | { type: 'ready' }
  | { type: 'rendered'; uri: string; renderedAt: number }
  | { type: 'error'; uri: string; message: string; line?: number }
  // ADR-0009 (revised) — webview asks host to open the source file at a line.
  // Used by the ErrorOverlay's "jump" affordance. `line` is 1-indexed.
  | { type: 'jumpToLine'; uri: string; line: number }

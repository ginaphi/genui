import * as path from 'node:path'
import * as vscode from 'vscode'

// Pinned panel registry per ADR-0010. One panel per Uri.toString().
// Reopen focuses existing. Disposal cleans up. `retainContextWhenHidden: true`
// preserves the webview's React state across tab switches.
//
// A separate "floating preview" panel exists per ADR-0013 (auto-preview.ts) —
// that one is NOT in this registry. Pinned vs floating are two distinct
// lifecycles; both can coexist.

const panels = new Map<string, vscode.WebviewPanel>()

let outputChannel: vscode.OutputChannel | undefined
function log(): vscode.OutputChannel {
  if (!outputChannel) outputChannel = vscode.window.createOutputChannel('Genui')
  return outputChannel
}

export function openOrFocus(
  uri: vscode.Uri,
  extensionUri: vscode.Uri,
  column: vscode.ViewColumn,
): vscode.WebviewPanel {
  const key = uri.toString()
  const existing = panels.get(key)
  if (existing) {
    existing.reveal(column)
    return existing
  }

  const panel = vscode.window.createWebviewPanel(
    'genui.preview',
    `Preview: ${path.basename(uri.fsPath)}`,
    column,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
      retainContextWhenHidden: true,
    },
  )

  attachExistingPanel(panel, uri, extensionUri)
  return panel
}

// Called by openOrFocus AND by the WebviewPanelSerializer (ADR-0012) on restore.
// Wires up a freshly-created or freshly-deserialized panel: html, registry,
// dispose handler, ready→update handshake, rendered/error logging.
export function attachExistingPanel(
  panel: vscode.WebviewPanel,
  uri: vscode.Uri,
  extensionUri: vscode.Uri,
): void {
  const key = uri.toString()

  panel.webview.html = renderWebviewHtml(panel.webview, extensionUri)
  panels.set(key, panel)

  panel.onDidDispose(() => {
    panels.delete(key)
  })

  wirePanelMessageHandlers(panel, uri, () => dispatchToPinned(uri))
}

// Dispatch the latest content to the pinned panel for this URI (if any).
// Called by the file watcher (ADR-0011). No-op if no pinned panel exists.
// `contentOverride` is used by type-mode (ADR-0003) to pass buffer content;
// when omitted, reads from disk (save-mode behavior, also ADR-0011).
export async function dispatchToPinned(uri: vscode.Uri, contentOverride?: string): Promise<void> {
  const panel = panels.get(uri.toString())
  if (!panel) return
  await postUpdateMessage(panel, uri, contentOverride)
}

// Shared helper exposed so auto-preview can dispatch via the same code path.
// Reads from disk by default; type-mode passes the buffer content as override.
export async function postUpdateMessage(
  panel: vscode.WebviewPanel,
  uri: vscode.Uri,
  contentOverride?: string,
): Promise<void> {
  let content: string
  if (contentOverride !== undefined) {
    content = contentOverride
  } else {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri)
      content = Buffer.from(bytes).toString('utf8')
    } catch {
      return // file gone or unreadable
    }
  }
  panel.webview.postMessage({
    type: 'update',
    format: 'openui',
    content,
    filename: path.basename(uri.fsPath),
    uri: uri.toString(),
  })
}

// Wires the standard message handlers for any panel — pinned or floating.
// `onReady` is invoked once on the first 'ready' from the webview, used to
// send the initial update.
export function wirePanelMessageHandlers(
  panel: vscode.WebviewPanel,
  uri: vscode.Uri,
  onReady: () => void | Promise<void>,
): void {
  // Fires on every 'ready' — including after we reset webview.html for a
  // settings change (ADR-0014). The webview re-mounts and re-handshakes;
  // we re-dispatch the current content. Idempotent: webview ignores updates
  // identical to current state.
  panel.webview.onDidReceiveMessage(msg => {
    if (msg && msg.type === 'ready') {
      void onReady()
    }
  })

  // ADR-0009 message handling — log rendered/error events for observability,
  // and act on jumpToLine requests from the ErrorOverlay.
  panel.webview.onDidReceiveMessage(msg => {
    if (!msg) return
    if (msg.type === 'rendered') {
      log().appendLine(
        `[rendered] ${path.basename(uri.fsPath)} at ${new Date(msg.renderedAt).toISOString()}`,
      )
    } else if (msg.type === 'error') {
      log().appendLine(
        `[error] ${path.basename(uri.fsPath)}${msg.line ? ` line ${msg.line}` : ''}: ${msg.message}`,
      )
    } else if (msg.type === 'jumpToLine') {
      void jumpToLine(msg.uri, msg.line)
    }
  })
}

// Open the source file at the given line. Triggered by the ErrorOverlay's
// jump button. The line is 1-indexed from the parser; VS Code uses 0-indexed.
async function jumpToLine(uriString: string, line: number): Promise<void> {
  try {
    const uri = vscode.Uri.parse(uriString)
    const doc = await vscode.workspace.openTextDocument(uri)
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Active,
      preview: false,
    })
    const lineIdx = Math.max(0, line - 1)
    const pos = new vscode.Position(lineIdx, 0)
    editor.selection = new vscode.Selection(pos, pos)
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter)
  } catch (err) {
    log().appendLine(`[jumpToLine] failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function renderWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.js'),
  )
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.css'),
  )
  const nonce = generateNonce()
  const padding = getPreviewPadding()
  const maxWidth = getPreviewMaxWidth()
  const rootStyle = maxWidth > 0 ? `#root{max-width:${maxWidth}px;margin:0 auto}` : ''

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};" />
    <link rel="stylesheet" href="${styleUri}" />
    <style>html,body{margin:0}body{padding:${padding}px;box-sizing:border-box}${rootStyle}</style>
    <title>Genui Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`
}

function getPreviewPadding(): number {
  const raw = vscode.workspace.getConfiguration('genui').get<number>('preview.padding', 24)
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 24
  return Math.max(0, Math.min(64, Math.floor(raw)))
}

function getPreviewMaxWidth(): number {
  const raw = vscode.workspace.getConfiguration('genui').get<number>('preview.maxWidth', 0)
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0
  return Math.max(0, Math.min(2400, Math.floor(raw)))
}

// Refresh HTML on all pinned panels — used by the config-change listener when
// genui.preview.padding changes. Resetting webview.html re-mounts the webview;
// the ready handshake fires again and dispatchToPinned re-pushes content.
export function refreshAllPinnedHtml(extensionUri: vscode.Uri): void {
  for (const panel of panels.values()) {
    panel.webview.html = renderWebviewHtml(panel.webview, extensionUri)
  }
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let nonce = ''
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return nonce
}

// Promote: take an existing panel (presumed to be the floating auto-preview)
// and register it as a pinned panel for the given URI. Used when the user
// explicitly runs Open Preview on a URI the floating panel is already showing —
// instead of creating a duplicate, promote in place.
export function adoptAsPinned(panel: vscode.WebviewPanel, uri: vscode.Uri): void {
  const key = uri.toString()
  panels.set(key, panel)
  panel.onDidDispose(() => {
    panels.delete(key)
  })
}

export function hasPinnedPanel(uri: vscode.Uri): boolean {
  return panels.has(uri.toString())
}

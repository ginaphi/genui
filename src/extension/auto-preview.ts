import * as path from 'node:path'
import * as vscode from 'vscode'
import {
  adoptAsPinned,
  hasPinnedPanel,
  postUpdateMessage,
  renderWebviewHtml,
  wirePanelMessageHandlers,
} from './panel-registry'

// Floating preview per ADR-0013 — ONE webview panel that follows the active
// editor. When a different .openui file becomes active, the panel retargets
// (title changes, new update message sent) — no new panel created.
//
// Distinct from PINNED panels (panel-registry.ts) which are per-URI and
// created via the explicit Open Preview command. Both lifecycles coexist:
// you can have a pinned panel for dashboard.openui AND a floating preview
// showing whatever you're currently editing.

const AUTO_PREVIEW_STARTUP_GRACE_MS = 1500
const activatedAt = Date.now()

let autoPreviewPanel: vscode.WebviewPanel | undefined
let autoPreviewUri: vscode.Uri | undefined

export function setupAutoPreview(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (!isAutoPreviewEnabled()) return
      if (Date.now() - activatedAt < AUTO_PREVIEW_STARTUP_GRACE_MS) return
      if (!editor || !isOpenUiUri(editor.document.uri)) return
      // If a pinned panel already exists for this URI, don't duplicate-show
      // it in the floating preview — the user explicitly created the pinned
      // one. Their attention is on it.
      if (hasPinnedPanel(editor.document.uri)) return
      void ensureFloatingPreview(editor.document.uri, context.extensionUri)
    }),
  )
}

async function ensureFloatingPreview(uri: vscode.Uri, extensionUri: vscode.Uri): Promise<void> {
  if (!autoPreviewPanel) {
    autoPreviewPanel = vscode.window.createWebviewPanel(
      'genui.preview',
      `Preview: ${path.basename(uri.fsPath)}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
        retainContextWhenHidden: true,
      },
    )
    autoPreviewPanel.webview.html = renderWebviewHtml(autoPreviewPanel.webview, extensionUri)

    autoPreviewPanel.onDidDispose(() => {
      autoPreviewPanel = undefined
      autoPreviewUri = undefined
    })

    // The webview hasn't loaded yet on first creation — wire the ready handler
    // and let it trigger the initial update.
    wirePanelMessageHandlers(autoPreviewPanel, uri, async () => {
      if (autoPreviewPanel && autoPreviewUri) {
        await postUpdateMessage(autoPreviewPanel, autoPreviewUri)
      }
    })
  } else {
    // Panel exists — update its title and send a fresh update message for
    // the new URI. preserveFocus=true so the editor keeps keyboard focus.
    autoPreviewPanel.title = `Preview: ${path.basename(uri.fsPath)}`
    autoPreviewPanel.reveal(vscode.ViewColumn.Beside, true)
  }

  autoPreviewUri = uri

  // For the re-target case (panel already existed), send the update immediately.
  // The first-create case is handled by the wirePanelMessageHandlers callback
  // above, which posts after the webview emits 'ready'.
  if (autoPreviewPanel.webview.html) {
    await postUpdateMessage(autoPreviewPanel, uri)
  }
}

// Called by the file watcher when a save or type event fires for `uri`.
// No-op if the floating panel isn't currently showing this URI.
// `contentOverride` is forwarded by type-mode (ADR-0003) to bypass disk read.
export async function dispatchToAutoPreview(
  uri: vscode.Uri,
  contentOverride?: string,
): Promise<void> {
  if (!autoPreviewPanel) return
  if (autoPreviewUri?.toString() !== uri.toString()) return
  await postUpdateMessage(autoPreviewPanel, uri, contentOverride)
}

// Called by the explicit Open Preview command when the user explicitly asks
// to pin a preview. If the floating panel happens to be showing the same URI,
// promote it to pinned (so we don't end up with two identical panels for the
// same file) and clear the floating state.
export function promoteFloatingIfMatches(uri: vscode.Uri): vscode.WebviewPanel | undefined {
  if (!autoPreviewPanel || autoPreviewUri?.toString() !== uri.toString()) return undefined
  const panel = autoPreviewPanel
  autoPreviewPanel = undefined
  autoPreviewUri = undefined
  adoptAsPinned(panel, uri)
  return panel
}

// Refresh the floating panel's HTML — used by the config-change listener when
// genui.preview.padding changes. No-op if no floating panel is currently shown.
export function refreshAutoPreviewHtml(extensionUri: vscode.Uri): void {
  if (!autoPreviewPanel) return
  autoPreviewPanel.webview.html = renderWebviewHtml(autoPreviewPanel.webview, extensionUri)
}

function isOpenUiUri(uri: vscode.Uri): boolean {
  return uri.fsPath.endsWith('.openui')
}

function isAutoPreviewEnabled(): boolean {
  return vscode.workspace.getConfiguration('genui').get<boolean>('autoPreview', true)
}

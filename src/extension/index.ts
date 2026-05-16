import * as vscode from 'vscode'
import { promoteFloatingIfMatches, refreshAutoPreviewHtml, setupAutoPreview } from './auto-preview'
import { openOrFocus, refreshAllPinnedHtml } from './panel-registry'
import { registerSerializer } from './serializer'
import { setupWatcher } from './watcher'

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    // Both commands accept an optional URI as the first arg — VS Code passes
    // the right-clicked resource URI when invoked from explorer/editor context
    // menus or the editor title bar. Falls back to the active editor's URI.
    vscode.commands.registerCommand('genui.openPreview', (uri?: vscode.Uri) => {
      openPreviewForUri(context, uri, vscode.ViewColumn.Active)
    }),
    vscode.commands.registerCommand('genui.openPreviewToSide', (uri?: vscode.Uri) => {
      openPreviewForUri(context, uri, vscode.ViewColumn.Beside)
    }),
    // ADR-0014: when preview chrome settings change, re-render all live panels'
    // HTML. The webview re-mounts and re-handshakes; existing wiring re-pushes
    // file content. No panels need to be reopened.
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('genui.preview')) {
        refreshAllPinnedHtml(context.extensionUri)
        refreshAutoPreviewHtml(context.extensionUri)
      }
    }),
  )

  setupAutoPreview(context)
  setupWatcher(context)
  registerSerializer(context)
}

function openPreviewForUri(
  context: vscode.ExtensionContext,
  uri: vscode.Uri | undefined,
  column: vscode.ViewColumn,
): void {
  const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri
  if (!targetUri || !isOpenUiUri(targetUri)) {
    vscode.window.showInformationMessage('Genui: open a .openui file first, then run this command.')
    return
  }
  // ADR-0013: if the floating auto-preview is currently showing this URI,
  // promote it to a pinned panel in place instead of creating a duplicate.
  if (promoteFloatingIfMatches(targetUri)) return
  openOrFocus(targetUri, context.extensionUri, column)
}

function isOpenUiUri(uri: vscode.Uri): boolean {
  return uri.fsPath.endsWith('.openui')
}

export function deactivate(): void {}

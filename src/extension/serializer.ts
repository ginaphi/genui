import * as vscode from 'vscode'
import { attachExistingPanel } from './panel-registry'

// Webview restart persistence per ADR-0012.
//
// Persist only the source URI as panel state. On restore: validate the file
// exists, attach the panel to the registry, re-read from disk via
// dispatchUpdate. Disk is the single source of truth — no content snapshot.
//
// Fallback HTML on deserialize errors mirrors microsoft/vscode's
// markdown-language-features pattern.

export function registerSerializer(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer('genui.preview', {
      async deserializeWebviewPanel(panel, state: { uri?: string } | null) {
        try {
          if (!state?.uri) {
            panel.dispose()
            return
          }
          const uri = vscode.Uri.parse(state.uri)
          const exists = await vscode.workspace.fs.stat(uri).then(
            () => true,
            () => false,
          )
          if (!exists) {
            panel.dispose()
            return
          }
          attachExistingPanel(panel, uri, context.extensionUri)
        } catch (e) {
          console.error('genui: failed to restore preview panel', e)
          panel.webview.html = restoreErrorHtml()
        }
      },
    }),
  )
}

function restoreErrorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none';" />
    <title>Genui Preview</title>
    <style>
      html, body { min-height: 100%; height: 100%; font-family: -apple-system, sans-serif; }
      .container { display: flex; justify-content: center; align-items: center; height: 100%; text-align: center; }
    </style>
  </head>
  <body><div class="container"><p>An unexpected error occurred while restoring the Genui preview.</p></div></body>
</html>`
}

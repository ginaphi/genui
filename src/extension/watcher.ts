import * as vscode from 'vscode'
import { dispatchToAutoPreview } from './auto-preview'
import { dispatchToPinned } from './panel-registry'

// File watcher per ADR-0011 (save) and ADR-0003 (renderOn: save | type).
//
// "save" mode (default): dispatch to BOTH pinned + floating on save and on
// external file changes. Reads from disk. Dedup window stops the
// in-editor save + fsWatcher echo from firing twice.
//
// "type" mode: dispatch on every keystroke, debounced 300ms per URI. Reads
// from the editor buffer so unsaved edits show live. External file changes
// still fire (same path as save mode), so an LLM writing the file mid-typing
// still triggers a re-render.

const lastInEditorSave = new Map<string, number>()
const SAVE_ECHO_WINDOW_MS = 500

const typingDebounce = new Map<string, NodeJS.Timeout>()
const TYPE_DEBOUNCE_MS = 300

export function setupWatcher(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (!isOpenUi(doc.uri)) return
      lastInEditorSave.set(doc.uri.toString(), Date.now())
      // Save supersedes any pending type-debounce — cancel it to avoid a
      // duplicate dispatch ~200ms later.
      cancelPendingTypeUpdate(doc.uri)
      void dispatch(doc.uri)
    }),

    vscode.workspace.onDidChangeTextDocument(event => {
      if (getRenderOnMode() !== 'type') return
      if (!isOpenUi(event.document.uri)) return
      if (event.contentChanges.length === 0) return // metadata-only
      scheduleTypeUpdate(event.document.uri)
    }),

    // When the user switches between save/type mid-editing, clear any pending
    // type-debounce timers so we don't fire after the user has opted out.
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('genui.renderOn')) {
        for (const timer of typingDebounce.values()) clearTimeout(timer)
        typingDebounce.clear()
      }
    }),
  )

  const fsWatcher = vscode.workspace.createFileSystemWatcher('**/*.openui')

  fsWatcher.onDidChange(uri => {
    if (isEchoOfInEditorSave(uri)) return
    void dispatch(uri)
  })

  fsWatcher.onDidCreate(uri => {
    if (isEchoOfInEditorSave(uri)) return
    void dispatch(uri)
  })

  context.subscriptions.push(fsWatcher)
}

async function dispatch(uri: vscode.Uri, content?: string): Promise<void> {
  await dispatchToPinned(uri, content)
  await dispatchToAutoPreview(uri, content)
}

function scheduleTypeUpdate(uri: vscode.Uri): void {
  const key = uri.toString()
  const existing = typingDebounce.get(key)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    typingDebounce.delete(key)
    // Re-read the document at fire time so we always dispatch the latest
    // buffer content, not the snapshot from the first keystroke in the window.
    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === key)
    if (!doc) return
    void dispatch(uri, doc.getText())
  }, TYPE_DEBOUNCE_MS)
  typingDebounce.set(key, timer)
}

function cancelPendingTypeUpdate(uri: vscode.Uri): void {
  const key = uri.toString()
  const existing = typingDebounce.get(key)
  if (existing) {
    clearTimeout(existing)
    typingDebounce.delete(key)
  }
}

function getRenderOnMode(): 'save' | 'type' {
  const raw = vscode.workspace.getConfiguration('genui').get<string>('renderOn', 'save')
  return raw === 'type' ? 'type' : 'save'
}

function isOpenUi(uri: vscode.Uri): boolean {
  return uri.fsPath.endsWith('.openui')
}

function isEchoOfInEditorSave(uri: vscode.Uri): boolean {
  const last = lastInEditorSave.get(uri.toString()) ?? 0
  return Date.now() - last < SAVE_ECHO_WINDOW_MS
}

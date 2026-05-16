import * as assert from 'node:assert'
import * as path from 'node:path'
import * as vscode from 'vscode'

// Smoke tests per "Path C" — narrow, fast, regression-focused.
// Future tests copy the patterns here.

suite('Genui extension', () => {
  test('extension is registered and activates', async () => {
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')
    assert.ok(ext, 'Extension ginaphi.generative-ui should be registered')
    await ext.activate()
    assert.strictEqual(ext.isActive, true)
  })

  test('both preview commands are registered', async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes('genui.openPreview'))
    assert.ok(commands.includes('genui.openPreviewToSide'))
  })

  test('openui language is registered', async () => {
    const languages = await vscode.languages.getLanguages()
    assert.ok(languages.includes('openui'))
  })

  test('openPreview no-ops cleanly when no active editor', async () => {
    await closeAllEditors()
    // Should not throw — extension shows info message and returns.
    await vscode.commands.executeCommand('genui.openPreview')
  })

  test('openPreview opens a panel when .openui file is active', async () => {
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    await ext.activate()

    const uri = vscode.Uri.file(path.join(ext.extensionPath, 'examples', 'hello.openui'))
    const doc = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(doc)

    await vscode.commands.executeCommand('genui.openPreview')
    // The command opens a webview panel. We can't inspect the webview's content
    // from the test runner, but a thrown exception or unhandled rejection would
    // surface here.
  })

  test('openPreview is idempotent — re-opening focuses existing panel (ADR-0010)', async () => {
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    await ext.activate()

    const uri = vscode.Uri.file(path.join(ext.extensionPath, 'examples', 'hello.openui'))
    const doc = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(doc)

    // Two consecutive opens should not throw. The second invocation reveals
    // the existing panel rather than creating a duplicate. We can't directly
    // count panels from the test API, but a duplicate-create bug would manifest
    // as either a thrown error or a webview lifecycle exception in dev tools.
    await vscode.commands.executeCommand('genui.openPreview')
    await vscode.commands.executeCommand('genui.openPreview')
  })

  test('opening multiple .openui files creates independent panels', async () => {
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    await ext.activate()

    const examplesDir = path.join(ext.extensionPath, 'examples')
    const files = ['hello.openui', 'changelog-callouts.openui']

    for (const filename of files) {
      const uri = vscode.Uri.file(path.join(examplesDir, filename))
      const doc = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(doc)
      await vscode.commands.executeCommand('genui.openPreview')
    }
    // No assertion needed — if the registry mis-keyed panels (e.g. shared one
    // panel across URIs by accident), the second post-message would race with
    // the first's HTML init and throw or hang.
  })

  test('openPreviewToSide command works on same file', async () => {
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    await ext.activate()

    const uri = vscode.Uri.file(path.join(ext.extensionPath, 'examples', 'hello.openui'))
    const doc = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(doc)

    await vscode.commands.executeCommand('genui.openPreviewToSide')
  })
})

// ADR-0013 — floating preview that follows the active editor.
// These tests verify the user-facing UX (no panel duplication) using only
// public VS Code APIs (vscode.window.tabGroups).
suite('Genui — floating preview lifecycle (ADR-0013)', () => {
  // The auto-preview module has a 1500ms startup grace period to suppress
  // events fired during workspace restore. Tests must wait past it.
  const STARTUP_GRACE_MS = 1600

  suiteSetup(async function () {
    this.timeout(5000)
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    await ext.activate()
    await wait(STARTUP_GRACE_MS)
  })

  setup(async () => {
    await closeAllEditors()
    await wait(150)
  })

  test('opening multiple .openui files via editor switches retargets a single floating preview', async function () {
    this.timeout(10000)
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    const examplesDir = path.join(ext.extensionPath, 'examples')

    for (const filename of [
      'hello.openui',
      'changelog-callouts.openui',
      'dashboard-analytics.openui',
    ]) {
      const uri = vscode.Uri.file(path.join(examplesDir, filename))
      const doc = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(doc)
      await wait(200)
    }
    await wait(500)

    assert.strictEqual(
      countPreviewTabs(),
      1,
      'Floating preview should retarget, not spawn N panels',
    )
  })

  test('explicit Open Preview on the file the floating is showing does NOT duplicate the panel', async function () {
    this.timeout(10000)
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    const uri = vscode.Uri.file(path.join(ext.extensionPath, 'examples', 'hello.openui'))
    const doc = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(doc)
    await wait(500) // floating spawns

    assert.strictEqual(countPreviewTabs(), 1, 'precondition: floating preview is showing')

    await vscode.commands.executeCommand('genui.openPreview')
    await wait(300)

    assert.strictEqual(
      countPreviewTabs(),
      1,
      'Open Preview on the same URI should promote the floating panel in place',
    )
  })

  test('explicit Open Preview on DIFFERENT URIs creates one pinned panel per URI (ADR-0010)', async function () {
    this.timeout(10000)
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    const examplesDir = path.join(ext.extensionPath, 'examples')

    // Isolate the pinned-only path — disable autoPreview so the floating
    // preview doesn't interleave with the per-URI pinned panels.
    const cfg = vscode.workspace.getConfiguration('genui')
    await cfg.update('autoPreview', false, vscode.ConfigurationTarget.Global)
    try {
      for (const filename of ['hello.openui', 'changelog-callouts.openui']) {
        const uri = vscode.Uri.file(path.join(examplesDir, filename))
        const doc = await vscode.workspace.openTextDocument(uri)
        await vscode.window.showTextDocument(doc)
        await vscode.commands.executeCommand('genui.openPreview')
        await wait(200)
      }

      assert.strictEqual(countPreviewTabs(), 2, 'Two distinct URIs should yield two pinned panels')
    } finally {
      await cfg.update('autoPreview', undefined, vscode.ConfigurationTarget.Global)
    }
  })
})

// ADR-0014 — preview chrome settings (padding, maxWidth).
suite('Genui — preview chrome settings (ADR-0014)', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    await ext.activate()
  })

  test('genui.preview.padding has a sane default (24)', () => {
    const value = vscode.workspace.getConfiguration('genui').get<number>('preview.padding')
    assert.strictEqual(value, 24)
  })

  test('genui.preview.maxWidth has a sane default (0 = unlimited)', () => {
    const value = vscode.workspace.getConfiguration('genui').get<number>('preview.maxWidth')
    assert.strictEqual(value, 0)
  })

  test('switching genui.renderOn to "type" and editing a document does not throw', async function () {
    this.timeout(10000)
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    const uri = vscode.Uri.file(path.join(ext.extensionPath, 'examples', 'hello.openui'))
    const doc = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(doc)
    await vscode.commands.executeCommand('genui.openPreview')
    await wait(300)

    const cfg = vscode.workspace.getConfiguration('genui')
    await cfg.update('renderOn', 'type', vscode.ConfigurationTarget.Global)
    try {
      // Use WorkspaceEdit instead of TextEditor#edit — it doesn't require the
      // editor to be focused, which can flake when the preview panel takes
      // focus on creation. The change still fires onDidChangeTextDocument.
      const applyTypingEdit = async (text: string) => {
        const we = new vscode.WorkspaceEdit()
        we.insert(uri, new vscode.Position(0, 0), text)
        await vscode.workspace.applyEdit(we)
      }

      await applyTypingEdit('# typing test\n')
      // Wait past the 300ms debounce so the dispatch fires.
      await wait(500)
      // Second edit exercises the supersedes-prior-timer path.
      await applyTypingEdit('# second\n')
      await wait(500)
    } finally {
      // Revert via undo so the example file stays clean. Document edits
      // applied via WorkspaceEdit are undo-able the same as keystrokes.
      await vscode.commands.executeCommand('workbench.action.files.revert')
      await cfg.update('renderOn', undefined, vscode.ConfigurationTarget.Global)
    }
  })

  test('changing preview chrome settings on a live panel does not throw', async function () {
    this.timeout(10000)
    const ext = vscode.extensions.getExtension('ginaphi.generative-ui')!
    const uri = vscode.Uri.file(path.join(ext.extensionPath, 'examples', 'hello.openui'))
    const doc = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(doc)
    await vscode.commands.executeCommand('genui.openPreview')
    await wait(300)

    const cfg = vscode.workspace.getConfiguration('genui')
    // Exercise the live-refresh path — this is what ensures
    // refreshAllPinnedHtml + refreshAutoPreviewHtml don't regress.
    await cfg.update('preview.padding', 40, vscode.ConfigurationTarget.Global)
    await wait(200)
    await cfg.update('preview.maxWidth', 1200, vscode.ConfigurationTarget.Global)
    await wait(200)
    await cfg.update('preview.padding', undefined, vscode.ConfigurationTarget.Global)
    await cfg.update('preview.maxWidth', undefined, vscode.ConfigurationTarget.Global)
  })
})

async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors')
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// VS Code wraps webview panels internally — the tab's input.viewType is
// `mainThreadWebview-<our-viewType>`, not the raw viewType we passed to
// createWebviewPanel. Duck-type the check; `instanceof vscode.TabInputWebview`
// is unreliable in the test runner (class identity differs across modules).
function countPreviewTabs(): number {
  return vscode.window.tabGroups.all
    .flatMap(g => g.tabs)
    .filter(t =>
      (t.input as { viewType?: string } | undefined)?.viewType?.endsWith('genui.preview'),
    ).length
}

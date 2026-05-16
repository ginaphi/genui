# Changelog

## [0.1.2] — icon rendering fix

### Fixed

- Icon re-rendered via resvg (proper SVG renderer) — fully opaque PNG, no transparent corners.

## [0.1.1] — icon + metadata polish

### Fixed

- Icon now full-bleed square (removes white corner bleed in Marketplace thumbnail).
- Extension description and categories cleaned up.

## [0.1.0] — first public release

### Added

- Live preview for `.openui` files. Renders in a webview beside the source.
- Two render modes via `genui.renderOn`:
  - `save` (default) — re-render on file save.
  - `type` — debounced 300ms keystroke render. Reads from the editor buffer so unsaved edits show live.
- Auto-preview on file open via `genui.autoPreview` (default `true`).
- Floating preview that retargets to the active `.openui` editor — click through N files, still one preview tab.
- Pinned per-URI panels via the explicit `Genui: Open Preview` / `Open Preview to the Side` commands. The floating preview promotes to pinned when you run the command on its current file.
- Polished error overlay with line numbers and a `[Jump →]` button that opens the source at the exact line.
- Last-good content stays visible on parse failure.
- Page chrome settings, live-refreshing on change:
  - `genui.preview.padding` (default 24, range 0–64).
  - `genui.preview.maxWidth` (default 0 = unlimited, max 2400).
- Survives `Reload Window` and IDE restart.
- Editor title-bar icon, explorer/editor context menus, `Cmd+K V` keybinding for side preview.
- Forced-light styling so the preview doesn't shift with the IDE theme — WYSIWYG with production embeds.
- 9 hand-curated example fixtures in `examples/`.
- 15 behavioural tests via `@vscode/test-cli`.
- Companion agent skills available separately at [ginaphi/skills](https://github.com/ginaphi/skills) — install via `npx skills@latest add ginaphi/skills`.

### Tech

- Extension host: TypeScript + esbuild.
- Webview: React 19 + Vite 6.
- Renderer: `@openuidev/react-lang` + `@openuidev/react-ui` + `@openuidev/react-headless`, exact-version pinned.

# Contributing to Genui

## Dev loop

```bash
pnpm install
pnpm run dev      # esbuild + Vite watch
# F5 in VS Code   # launches Extension Development Host
pnpm run test     # behavioural tests via @vscode/test-cli
pnpm run check    # typecheck + lint
pnpm run package  # produces genui-X.X.X.vsix
```

## When you change something

- Add a behavioural test in `src/test/extension.test.ts` if you're changing user-facing behaviour. Existing tests use `vscode.window.tabGroups` to count preview panels — duck-type the tab `viewType`, don't rely on `instanceof`.
- Update `CHANGELOG.md` under the relevant section.
- If you're adding a new format renderer, drop a module in `src/renderers/<format>/index.tsx` exporting `{ extensions, formatId, Renderer }`, register it in `src/webview/App.tsx`'s `RENDERERS` map. The webview shell stays format-agnostic; no other code should need to change.
- If you're adding or editing a `.openui` example: validate with `node .claude/skills/openui-lang/scripts/validate.mjs examples/your-file.openui` (this script is part of the [companion skills](https://github.com/ginaphi/skills) — install once via `npx skills@latest add ginaphi/skills`).

## Reporting issues

Bugs and feature requests: https://github.com/ginaphi/genui/issues

When reporting a render bug, paste the **red error banner text** from the preview — that's the renderer's ground truth and contains the file path + line number. The `[Jump →]` button on the banner opens the source at the exact line.

## Out of scope

- Editing UI from within the preview (one-way render only by design)
- Bundled AI / agent (agents write files; the extension reads them)
- Telemetry, analytics, or network calls (CSP forbids network from the webview)
- Syntax highlighting / IntelliSense / language-server for `.openui` in v1

## License

MIT — see [`LICENSE`](LICENSE).

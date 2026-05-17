# Genui — Generative UI Preview

Your AI writes a UI spec in plain text. This extension renders it live in VS Code. Together they turn any agent — Claude Code, Codex, Cursor, Copilot — into a live UI prototyping tool.

## Two pieces

Genui is a two-piece product. Both must be installed:

- **The extension** (this repo) renders `.openui` files in a VS Code preview pane that updates on every save.
- **The skill** ([`ginaphi/skills`](https://github.com/ginaphi/skills)) teaches your AI how to write OpenUI Lang — the strict, declarative syntax the renderer expects.

The extension without the skill is a renderer with nothing to render. The skill without the extension is correct text that nobody sees. Together: your AI authors prototypes you can review live in the editor.

![Operations overview rendered live in the Genui preview pane — KPI cards, line + donut charts, ranked routes, and a recent-events table](images/banner.png)

## Get started

**1. Install the extension**

Search **Genui** in the VS Code Extensions panel, or:

```
ext install ginaphi.generative-ui
```

**2. Install the skill**

```
npx skills@latest add ginaphi/skills
```

Pick `genui` when prompted. Works with Claude Code, Cursor, Copilot, and most other agents.

**3. Ask your AI**

> `/genui a settings page` — or just "genui this"

The agent writes a `.openui` file in `docs/prototype/`.

**4. See it rendered**

Open the `.openui` file — the preview appears automatically. If not, click the preview icon in the editor title bar.

## Acknowledgments

[OpenUI Lang](https://github.com/thesysdev/openui) — the language, the renderer, the component library. Genui is the IDE integration layer on top.

## License

MIT — see [LICENSE](LICENSE).

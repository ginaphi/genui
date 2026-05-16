# Genui — Generative UI Preview

![Hero: source code on the left, live rendered preview on the right](images/hero.png)

Your AI writes a UI spec in plain text. This extension renders it live in VS Code. The skill teaches your AI the right syntax.

## Get started

Both pieces are needed — the extension renders, the skill writes.

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

> "sketch a settings page" · "mock up a dashboard" · "genui this"

The agent writes a `.openui` file in `docs/prototype/`.

**4. See it rendered**

Open the `.openui` file — the preview appears automatically. If not, click the preview icon in the editor title bar.

## Acknowledgments

[OpenUI Lang](https://github.com/thesysdev/openui) — the language, the renderer, the component library. Genui is the IDE integration layer on top.

## License

MIT — see [LICENSE](LICENSE).

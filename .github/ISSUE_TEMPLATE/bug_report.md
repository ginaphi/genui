---
name: Bug report
about: Something rendered wrong, crashed, or behaved unexpectedly
title: ''
labels: bug
assignees: ''
---

<!--
Provide the requested details to make triage fast. Incomplete reports may
get a "needs info" label.
-->

## What happened

<!-- One or two sentences. What did you do? What did Genui do? What did you expect? -->

## Reproduction

A minimal `.openui` file that reproduces the issue (paste inline; smaller is better):

```openui
root = Stack([...])
```

## Error banner text

<!-- If a red error banner appeared in the preview, paste its full text here.
     The banner is the renderer's ground truth — including the line number and
     the [Jump →] target. -->

## Environment

- Genui version: <!-- v0.2.0 / from VSIX / from F5 dev host -->
- IDE: <!-- VS Code 1.85 / Cursor 0.42 / Windsurf / VSCodium -->
- OS: <!-- macOS 15.4 / Windows 11 / Ubuntu 24.04 -->
- `.openui` source: <!-- written by Claude / Cursor agent / hand-typed -->

## Anything else

<!-- Screenshots, console output from `Webview Developer Tools`, related issues, theories. -->

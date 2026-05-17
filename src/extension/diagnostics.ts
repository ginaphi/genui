import {
  createParser,
  type LibraryJSONSchema,
  type ParseResult,
  type Parser,
  type ValidationError,
} from '@openuidev/lang-core'
import * as vscode from 'vscode'
import schema from './openui-schema.json'

// Diagnostics for .openui files. Runs the same lang-core parser the renderer
// uses, surfaces three classes of problem into VS Code's Problems panel:
//
//   1. Validation errors  — Error severity (e.g. missing required prop)
//   2. Unresolved refs    — Error severity (reference to undefined name)
//   3. Orphaned defs      — Warning severity (defined but unreachable from
//                           root; silently dropped by the renderer — the
//                           #1 "where did my element go?" footgun)
//
// Trigger: open / change (200ms debounce) / save (immediate) / close.

const DIAGNOSTIC_SOURCE = 'Genui'
const DEBOUNCE_MS = 200

export function setupDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection('openui')
  context.subscriptions.push(collection)

  const parser = createParser(schema as unknown as LibraryJSONSchema)
  const timers = new Map<string, NodeJS.Timeout>()

  function run(doc: vscode.TextDocument, immediate: boolean): void {
    if (doc.languageId !== 'openui') return
    const key = doc.uri.toString()
    const existing = timers.get(key)
    if (existing) {
      clearTimeout(existing)
      timers.delete(key)
    }
    if (immediate) {
      collection.set(doc.uri, computeDiagnostics(parser, doc))
      return
    }
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        collection.set(doc.uri, computeDiagnostics(parser, doc))
      }, DEBOUNCE_MS),
    )
  }

  for (const doc of vscode.workspace.textDocuments) run(doc, true)

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => run(doc, true)),
    vscode.workspace.onDidChangeTextDocument(e => run(e.document, false)),
    vscode.workspace.onDidSaveTextDocument(doc => run(doc, true)),
    vscode.workspace.onDidCloseTextDocument(doc => {
      collection.delete(doc.uri)
      const key = doc.uri.toString()
      const t = timers.get(key)
      if (t) {
        clearTimeout(t)
        timers.delete(key)
      }
    }),
  )
}

function computeDiagnostics(parser: Parser, doc: vscode.TextDocument): vscode.Diagnostic[] {
  const text = doc.getText()
  let result: ParseResult
  try {
    result = parser.parse(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return [diagnostic(doc, 0, `Parse exception: ${message}`, vscode.DiagnosticSeverity.Error)]
  }

  const out: vscode.Diagnostic[] = []
  const stmtLines = indexStatementLines(text)

  for (const err of result.meta.errors) {
    const line = (err.statementId ? stmtLines.get(err.statementId) : undefined) ?? 0
    out.push(diagnostic(doc, line, formatValidationError(err), vscode.DiagnosticSeverity.Error))
  }

  for (const name of result.meta.unresolved) {
    const refLines = findReferenceLines(text, name, stmtLines.get(name))
    if (refLines.length === 0) {
      out.push(
        diagnostic(
          doc,
          0,
          `Unresolved reference "${name}" — used but not defined.`,
          vscode.DiagnosticSeverity.Error,
        ),
      )
    } else {
      for (const line of refLines) {
        out.push(
          diagnostic(
            doc,
            line,
            `Unresolved reference "${name}" — used but not defined.`,
            vscode.DiagnosticSeverity.Error,
          ),
        )
      }
    }
  }

  for (const name of result.meta.orphaned) {
    const line = stmtLines.get(name) ?? 0
    out.push(
      diagnostic(
        doc,
        line,
        `"${name}" is defined but never referenced — it will not render. Add it to a parent's children array.`,
        vscode.DiagnosticSeverity.Warning,
      ),
    )
  }

  return out
}

// Map `identifier = ...` statement names to their 0-based line index.
function indexStatementLines(text: string): Map<string, number> {
  const map = new Map<string, number>()
  const lines = text.split(/\r?\n/)
  const pattern = /^\s*(\$?[A-Za-z_][A-Za-z0-9_]*)\s*=/
  for (let i = 0; i < lines.length; i++) {
    const m = pattern.exec(lines[i])
    if (m) map.set(m[1], i)
  }
  return map
}

// Find lines that reference `name` (other than the line that defines it).
function findReferenceLines(
  text: string,
  name: string,
  definitionLine: number | undefined,
): number[] {
  const lines = text.split(/\r?\n/)
  const escaped = name.replace(/[$\\^]/g, '\\$&')
  const regex = new RegExp(`(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])`)
  const hits: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (i === definitionLine) continue
    if (regex.test(lines[i])) hits.push(i)
  }
  return hits
}

function diagnostic(
  doc: vscode.TextDocument,
  line: number,
  message: string,
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic {
  const safeLine = Math.max(0, Math.min(line, Math.max(0, doc.lineCount - 1)))
  const range = doc.lineAt(safeLine).range
  const d = new vscode.Diagnostic(range, message, severity)
  d.source = DIAGNOSTIC_SOURCE
  return d
}

function formatValidationError(err: ValidationError): string {
  const where = err.component || 'component'
  const at = err.path ? ` (prop ${err.path})` : ''
  return `${where}${at}: ${err.message}`
}

import { Renderer } from '@openuidev/react-lang'
// Import from the `./genui-lib` subpath — narrower than the root export which
// pulls in chat-specific components (Copilot, ShareThread, ImageGallery, …)
// we don't use. Drops ~30-150KB raw from the webview bundle; see ADR-0015.
import { openuiLibrary } from '@openuidev/react-ui/genui-lib'
import '@openuidev/react-ui/components.css'
import type { RendererError } from '../../shared/message'

// Renderer Module per ADR-0001 (revised: onError signature is array-based,
// matching OpenUI's native onError contract. Empty array = render succeeded).
//
// Each renderer module exports { extensions, formatId, Renderer }.

export const openuiRenderer = {
  extensions: ['.openui'] as const,
  formatId: 'openui' as const,
  Renderer: OpenUiRenderer,
}

function OpenUiRenderer({
  content,
  onError,
}: {
  content: string
  onError: (errs: RendererError[]) => void
}) {
  return (
    <Renderer
      response={content}
      library={openuiLibrary}
      isStreaming={false}
      onError={(errs: Array<{ message?: string; line?: number }>) => {
        onError(
          errs.map(e => ({
            message: e.message ?? 'Unknown parse error',
            line: e.line,
          })),
        )
      }}
    />
  )
}

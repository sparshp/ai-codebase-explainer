import { useEffect, useId, useMemo, useState } from 'react'
import mermaid from 'mermaid'

let mermaidReady = false

function ensureMermaid() {
  if (mermaidReady) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    suppressErrorRendering: true,
    flowchart: { curve: 'basis', htmlLabels: false },
    sequence: { actorMargin: 40, messageMargin: 30 },
  })
  mermaidReady = true
}

/**
 * Fix common LLM Mermaid mistakes that break Mermaid 11.
 * Historical answers in the DB often have unquoted labels with spaces/parens/→ —
 * this must repair them at render time so old chats still draw.
 */
export function sanitizeMermaidCode(raw: string): string {
  let code = raw.trim()

  code = code.replace(/^```(?:mermaid)?\s*/i, '').replace(/```$/g, '').trim()

  // Citations like [CartPanel.tsx:29] inside labels break parsers
  code = code.replace(/\[[^\]]+\.\w+:\d+(?:-\d+)?\]/g, '')

  code = code.replace(/\*\*/g, '').replace(/__/g, '')

  // Smart quotes / fullwidth brackets → ASCII
  code = code
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\uFF3B/g, '[')
    .replace(/\uFF3D/g, ']')

  // Unicode arrows/dashes → ASCII (LLM loves → inside labels)
  code = code
    .replace(/[\u2192\u21D2\u2794\u279C\u279D\u279E]/g, '->')
    .replace(/[\u2190\u21D0]/g, '<-')
    .replace(/[\u2014\u2013]/g, '-')

  code = code.replace(/^\s*graph\s+/im, 'flowchart ')

  if (!/^\s*(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)\b/im.test(code)) {
    code = `flowchart TB\n${code}`
  }

  // Flatten parenthetical asides inside unquoted square labels before quoting
  //   B[CartPannel (handleCreateOrder)] → B[CartPannel handleCreateOrder]
  code = code.replace(
    /\b([A-Za-z][\w]*)\[([^\]"]+)\]/g,
    (_m, id: string, label: string) => {
      const safe = label
        .replace(/"/g, "'")
        .replace(/\([^)]*\)/g, (paren) => ` ${paren.slice(1, -1)} `)
        .replace(/[()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return `${id}["${safe}"]`
    }
  )

  // Stadium shapes: A([label with spaces])
  code = code.replace(
    /\b([A-Za-z][\w]*)\(\[([^\]"]+)\]\)/g,
    (_m, id: string, label: string) => {
      const safe = label.replace(/"/g, "'").replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
      return `${id}(["${safe}"])`
    }
  )

  // Diamonds: A{Ready?}
  code = code.replace(
    /\b([A-Za-z][\w]*)\{([^}"]+)\}/g,
    (_m, id: string, label: string) => {
      const safe = label.replace(/"/g, "'").replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
      return `${id}{"${safe}"}`
    }
  )

  return code.trim()
}

function looksLikeMermaidErrorSvg(svg: string): boolean {
  return /syntax error/i.test(svg) || /error-icon|mermaid-error/i.test(svg)
}

interface Props {
  code: string
}

/** Renders a Mermaid UML / sequence / class / flowchart diagram. */
export function MermaidDiagram({ code }: Props) {
  const reactId = useId().replace(/:/g, '')
  // Sync sanitize so source panel never shows raw broken LLM text
  const chart = useMemo(() => sanitizeMermaidCode(code), [code])

  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!chart) return

    async function render() {
      try {
        ensureMermaid()
        const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 8)}`
        // Skip mermaid.parse — it can false-fail; render is the source of truth
        const { svg: rendered } = await mermaid.render(id, chart)

        if (cancelled) return

        if (looksLikeMermaidErrorSvg(rendered)) {
          setSvg(null)
          setError('Invalid Mermaid syntax from the model')
          setShowSource(true)
          return
        }

        setSvg(rendered)
        setError(null)
      } catch (err: unknown) {
        if (!cancelled) {
          setSvg(null)
          setError(err instanceof Error ? err.message : 'Could not render diagram')
          setShowSource(true)
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart, reactId])

  return (
    <div style={{
      margin: '12px 0',
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      overflow: 'hidden',
      background: '#FAFAFA',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #E5E7EB',
        background: '#F3F4F6',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', letterSpacing: '0.02em' }}>
          {error ? 'Diagram (unrendered)' : 'UML diagram'}
        </span>
        <button
          type="button"
          onClick={() => setShowSource(s => !s)}
          style={{
            fontSize: '11px',
            color: '#534AB7',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {showSource ? 'Hide source' : 'Show Mermaid'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', fontSize: '12px', color: '#92400E', background: '#FFFBEB', lineHeight: 1.5 }}>
          Couldn’t render this diagram (invalid Mermaid from the model). Prose and citations above still apply — try asking again, or open Mermaid source.
        </div>
      )}

      {svg && !showSource && (
        <div
          style={{ padding: '16px', overflowX: 'auto', textAlign: 'center' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {(showSource || error || !svg) && (
        <pre style={{
          margin: 0,
          padding: '14px',
          fontSize: '11px',
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, monospace',
          color: '#374151',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          background: '#FFFFFF',
        }}>
          {chart}
        </pre>
      )}
    </div>
  )
}

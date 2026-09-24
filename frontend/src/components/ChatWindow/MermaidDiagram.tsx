import { useEffect, useId, useState } from 'react'
import mermaid from 'mermaid'

let mermaidReady = false

function ensureMermaid() {
  if (mermaidReady) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    // Don't inject Mermaid's bomb/"Syntax error in text" SVG into the DOM
    suppressErrorRendering: true,
    flowchart: { curve: 'basis', htmlLabels: false },
    sequence: { actorMargin: 40, messageMargin: 30 },
  })
  mermaidReady = true
}

/** Fix common LLM Mermaid mistakes that break Mermaid 11. */
export function sanitizeMermaidCode(raw: string): string {
  let code = raw.trim()

  // Drop accidental fence markers inside the block
  code = code.replace(/^```(?:mermaid)?\s*/i, '').replace(/```$/g, '').trim()

  // Citations like [CartPanel.tsx:29] inside labels break parsers — strip them
  code = code.replace(/\[[^\]]+\.\w+:\d+(?:-\d+)?\]/g, '')

  // Markdown bold/italics inside diagrams
  code = code.replace(/\*\*/g, '').replace(/__/g, '')

  // Smart quotes → ASCII
  code = code.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")

  // Unicode arrows / dashes inside labels confuse the edge lexer — normalize
  code = code
    .replace(/[→⇒➔➜➝➞]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/[—–]/g, '-')

  // Prefer flowchart over deprecated graph keyword
  code = code.replace(/^\s*graph\s+/im, 'flowchart ')

  if (!/^\s*(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)\b/im.test(code)) {
    code = `flowchart TB\n${code}`
  }

  // Always quote square labels (spaces, parens, unicode all break Mermaid 11):
  //   B[CartPannel (handleCreateOrder)] → B["CartPannel (handleCreateOrder)"]
  // Skip already-quoted: A["..."]
  code = code.replace(
    /\b([A-Za-z][\w]*)\[([^\]"]+)\]/g,
    (_m, id: string, label: string) => {
      const safe = label.replace(/"/g, "'").trim()
      return `${id}["${safe}"]`
    }
  )

  // Round / stadium shapes: A([label]) or A(label with spaces)
  code = code.replace(
    /\b([A-Za-z][\w]*)\(\[([^\]"]+)\]\)/g,
    (_m, id: string, label: string) => {
      const safe = label.replace(/"/g, "'").trim()
      return `${id}(["${safe}"])`
    }
  )
  code = code.replace(
    /\b([A-Za-z][\w]*)\(([^)"\n]+)\)/g,
    (_m, id: string, label: string) => {
      // Skip edge syntax leftovers / empty
      if (!label.trim() || /^( -->|---|-\.->)/.test(label)) return _m
      const safe = label.replace(/"/g, "'").trim()
      return `${id}("${safe}")`
    }
  )

  // Diamond decisions: A{Ready?} → A{"Ready?"}
  code = code.replace(
    /\b([A-Za-z][\w]*)\{([^}"]+)\}/g,
    (_m, id: string, label: string) => {
      const safe = label.replace(/"/g, "'").trim()
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
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)
  const [safeCode, setSafeCode] = useState(code)

  useEffect(() => {
    let cancelled = false
    const chart = sanitizeMermaidCode(code)
    setSafeCode(chart)
    if (!chart) return

    async function render() {
      try {
        ensureMermaid()
        // Validate first — throws on bad syntax instead of returning error SVG
        await mermaid.parse(chart)
        const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 8)}`
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
      } catch (err: any) {
        if (!cancelled) {
          setSvg(null)
          setError(err?.message || 'Could not render diagram')
          setShowSource(true)
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [code, reactId])

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
          {safeCode || code.trim()}
        </pre>
      )}
    </div>
  )
}

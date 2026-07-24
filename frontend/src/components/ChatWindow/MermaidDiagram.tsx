import { useEffect, useId, useState } from 'react'
import mermaid from 'mermaid'

let mermaidReady = false

function ensureMermaid() {
  if (mermaidReady) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    flowchart: { curve: 'basis', htmlLabels: true },
    sequence: { actorMargin: 40, messageMargin: 30 },
  })
  mermaidReady = true
}

interface Props {
  code: string
}

/** Renders a Mermaid UML / sequence / class / flowchart diagram. */
export function MermaidDiagram({ code }: Props) {
  const reactId = useId().replace(/:/g, '')
  const [svg, setSvg]       = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)

  useEffect(() => {
    let cancelled = false
    const chart = code.trim()
    if (!chart) return

    async function render() {
      try {
        ensureMermaid()
        const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 8)}`
        const { svg: rendered } = await mermaid.render(id, chart)
        if (!cancelled) {
          setSvg(rendered)
          setError(null)
        }
      } catch (err: any) {
        if (!cancelled) {
          setSvg(null)
          setError(err?.message || 'Could not render diagram')
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
          UML diagram
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
        <div style={{ padding: '12px', fontSize: '12px', color: '#B45309', background: '#FFFBEB' }}>
          Diagram could not be rendered. Showing source below.
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
          {code.trim()}
        </pre>
      )}
    </div>
  )
}

import type { ReactNode } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useUIStore } from '../../store/ui.store'

type CitationMap = Record<string, {
  filePath:  string
  line:      number | string
  verified:  boolean
  chunkText?: string
}>

interface Props {
  text:      string
  citations: CitationMap
}

function CitBadge({ citation }: { citKey: string; citation: CitationMap[string] }) {
  const setActiveCitation = useUIStore(s => s.setActiveCitation)
  const ok = citation?.verified

  return (
    <button
      type="button"
      onClick={() => setActiveCitation({
        filePath: citation.filePath,
        line: Number(citation.line) || 0,
        verified: citation.verified,
        chunkText: citation.chunkText,
      })}
      title={ok ? 'View source code' : 'Unverified reference'}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '4px',
        fontSize:     '11px',
        fontFamily:   'ui-monospace, monospace',
        padding:      '2px 8px',
        borderRadius: '6px',
        cursor:       'pointer',
        border:       `1px solid ${ok ? '#86EFAC' : '#E5E7EB'}`,
        background:   ok ? '#ECFDF5' : '#F9FAFB',
        color:        ok ? '#065F46' : '#6B7280',
        verticalAlign:'middle',
        margin:       '0 2px',
        fontWeight:   500,
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: ok ? '#10B981' : '#9CA3AF',
      }} />
      {citation?.filePath?.split('/').pop()}:{citation?.line}
    </button>
  )
}

function findCitation(text: string, citations: CitationMap) {
  const bracket = text.match(/\[([^\]]+\.\w+):(\d+)\]/)
  if (bracket) {
    const key = `${bracket[1]}:${bracket[2]}`
    if (citations[key]) return { key, citation: citations[key] }
  }

  const fileRef = text.match(/^([a-zA-Z0-9_./()[\]-]+\.\w+):(\d+)(?:-\d+)?$/)
  if (fileRef) {
    const key = `${fileRef[1]}:${fileRef[2]}`
    if (citations[key]) return { key, citation: citations[key] }
    const fallback = Object.entries(citations).find(([k]) => k.startsWith(fileRef[1] + ':'))
    if (fallback) return { key: fallback[0], citation: fallback[1] }
  }

  return null
}

function renderInline(text: string, citations: CitationMap, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\.\w+:\d+\])/g)

  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} style={{ fontWeight: 600, color: '#111827' }}>
          {part.slice(2, -2)}
        </strong>
      )
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      const inner = part.slice(1, -1)
      const cit   = findCitation(inner, citations)
      if (cit) return <CitBadge key={key} citKey={cit.key} citation={cit.citation} />

      return (
        <code key={key} style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '12px',
          background: '#F3F4F6',
          color: '#1F2937',
          padding: '1px 6px',
          borderRadius: '5px',
          border: '1px solid #E5E7EB',
        }}>
          {inner}
        </code>
      )
    }

    const bracket = part.match(/^\[([^\]]+\.\w+):(\d+)\]$/)
    if (bracket) {
      const citKey = `${bracket[1]}:${bracket[2]}`
      const c = citations[citKey]
      if (c) return <CitBadge key={key} citKey={citKey} citation={c} />
    }

    return <span key={key}>{part}</span>
  })
}

function StepCard({ num, title, body, citations }: {
  num: number; title: string; body: string; citations: CitationMap
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '12px 14px',
      marginBottom: '8px',
      background: 'linear-gradient(135deg, #F8F7FF 0%, #FFFFFF 100%)',
      border: '1px solid #E8E5FF',
      borderRadius: '12px',
      borderLeft: '3px solid #534AB7',
    }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
        background: '#534AB7', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 700,
      }}>
        {num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontWeight: 600, color: '#312E81', marginBottom: '4px', fontSize: '13px' }}>
            {renderInline(title, citations, `step-${num}-t`)}
          </div>
        )}
        <div style={{ color: '#374151', fontSize: '13px', lineHeight: 1.65 }}>
          {renderInline(body, citations, `step-${num}-b`)}
        </div>
      </div>
    </div>
  )
}

function ImprovementSection({ items, citations }: { items: string[]; citations: CitationMap }) {
  if (items.length === 0) return null

  return (
    <div style={{
      marginTop: '14px',
      padding: '14px 16px',
      background: 'linear-gradient(135deg, #FFFBEB 0%, #FFF7ED 100%)',
      border: '1px solid #FDE68A',
      borderRadius: '12px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '10px', fontWeight: 600, fontSize: '13px', color: '#92400E',
      }}>
        <span style={{
          width: '22px', height: '22px', borderRadius: '6px',
          background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px',
        }}>
          ✦
        </span>
        Could be improved
      </div>
      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, i) => (
          <li key={i} style={{ color: '#78350F', fontSize: '13px', lineHeight: 1.6 }}>
            {renderInline(item.replace(/^\d+\.\s*/, ''), citations, `imp-${i}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SummaryCallout({ text, citations }: { text: string; citations: CitationMap }) {
  return (
    <div style={{
      marginTop: '12px',
      padding: '12px 14px',
      background: '#EFF6FF',
      border: '1px solid #BFDBFE',
      borderRadius: '10px',
      borderLeft: '3px solid #3B82F6',
      fontSize: '13px',
      color: '#1E40AF',
      lineHeight: 1.6,
    }}>
      <span style={{ fontWeight: 600, marginRight: '6px' }}>Summary</span>
      {renderInline(text.replace(/^summary:\s*/i, ''), citations, 'summary')}
    </div>
  )
}

function parseAndRender(text: string, citations: CitationMap) {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let i = 0
  let blockKey = 0
  let improvementItems: string[] = []
  let inImprovement = false

  const flushImprovement = () => {
    if (improvementItems.length > 0) {
      nodes.push(
        <ImprovementSection key={`imp-${blockKey++}`} items={improvementItems} citations={citations} />
      )
      improvementItems = []
    }
    inImprovement = false
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      if (inImprovement) { i++; continue }
      i++
      continue
    }

    if (trimmed.startsWith('```')) {
      flushImprovement()
      const lang = trimmed.slice(3).trim() || 'typescript'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      nodes.push(
        <div key={`code-${blockKey++}`} style={{ margin: '10px 0', borderRadius: '10px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
          <SyntaxHighlighter
            language={lang}
            style={atomOneLight}
            customStyle={{ margin: 0, padding: '14px', fontSize: '12px', lineHeight: 1.5 }}
            wrapLongLines
          >
            {codeLines.join('\n')}
          </SyntaxHighlighter>
        </div>
      )
      continue
    }

    if (/^\*\*Improvement Points?:?\*\*$/i.test(trimmed)) {
      flushImprovement()
      inImprovement = true
      i++
      continue
    }

    if (inImprovement && /^\d+\.\s+/.test(trimmed)) {
      improvementItems.push(trimmed.replace(/^\d+\.\s+/, ''))
      i++
      continue
    }

    if (inImprovement && !/^\d+\.\s+/.test(trimmed)) {
      flushImprovement()
    }

    const stepMatch = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)$/)
    if (stepMatch) {
      nodes.push(
        <StepCard
          key={`step-${blockKey++}`}
          num={parseInt(stepMatch[1], 10)}
          title={stepMatch[2]}
          body={stepMatch[3]}
          citations={citations}
        />
      )
      i++
      continue
    }

    const stepPlain = trimmed.match(/^Step\s+(\d+):\s*(.*)$/i)
    if (stepPlain) {
      const body = stepPlain[2]
      const dash = body.split(/\s+—\s+/)
      nodes.push(
        <StepCard
          key={`step-${blockKey++}`}
          num={parseInt(stepPlain[1], 10)}
          title={dash.length > 1 ? dash[0] : ''}
          body={dash.length > 1 ? dash.slice(1).join(' — ') : body}
          citations={citations}
        />
      )
      i++
      continue
    }

    if (/^summary:/i.test(trimmed)) {
      nodes.push(<SummaryCallout key={`sum-${blockKey++}`} text={trimmed} citations={citations} />)
      i++
      continue
    }

    if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed) && trimmed.length < 80) {
      nodes.push(
        <h4 key={`h-${blockKey++}`} style={{
          margin: '14px 0 8px', fontSize: '13px', fontWeight: 600, color: '#534AB7',
        }}>
          {trimmed.replace(/\*\*/g, '')}
        </h4>
      )
      i++
      continue
    }

    const paraLines: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('```')) {
      const next = lines[i].trim()
      if (/^\d+\.\s+\*\*/.test(next) || /^Step\s+\d+:/i.test(next)) break
      if (/^\*\*Improvement Points?:?\*\*$/i.test(next)) break
      paraLines.push(lines[i])
      i++
    }

    nodes.push(
      <p key={`p-${blockKey++}`} style={{
        margin: '0 0 10px', fontSize: '13px', lineHeight: 1.68, color: '#374151',
      }}>
        {renderInline(paraLines.join(' '), citations, `p-${blockKey}`)}
      </p>
    )
  }

  flushImprovement()
  return nodes
}

export function AnswerRenderer({ text, citations }: Props) {
  if (!text) return null
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{parseAndRender(text, citations)}</div>
}

export { CitBadge }

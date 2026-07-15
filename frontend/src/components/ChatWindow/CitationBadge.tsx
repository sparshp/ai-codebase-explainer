import { useUIStore } from '../../store/ui.store'

interface Props {
  citationKey: string
  citation:    { filePath: string; line: number; verified: boolean; chunkText?: string }
}

export function CitationBadge({ citation }: Props) {
  const setActiveCitation = useUIStore(s => s.setActiveCitation)

  return (
    <button
      onClick={() => setActiveCitation(citation)}
      title={citation.verified ? 'Verified citation' : 'Could not verify this file path'}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono mx-0.5
        ${citation.verified
          ? 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
          : 'bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200'
        } cursor-pointer`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${citation.verified ? 'bg-green-500' : 'bg-gray-400'}`} />
      {citation.filePath.split('/').pop()}:{citation.line}
    </button>
  )
}
export interface RankedResult {
  id:          string
  rrfScore:    number
  vectorScore?: number
  bm25Score?:  number
  text:        string
  metadata:    Record<string, any>
}

export function rrfFuse(
  vectorResults: Array<{ id: string; score: number; text: string; metadata: Record<string, any> }>,
  bm25Results:   Array<{ id: string; score: number; text: string; metadata: Record<string, any> }>,
  k: number = 60,
  topK: number = 10
): RankedResult[] {
  const scores: Map<string, RankedResult> = new Map()

  function addScore(
    results: typeof vectorResults,
    scoreKey: 'vectorScore' | 'bm25Score'
  ) {
    results.forEach(({ id, score, text, metadata }, rank) => {
      const existing = scores.get(id) || { id, rrfScore: 0, text, metadata }
      existing.rrfScore += 1 / (k + rank + 1)
      existing[scoreKey] = score
      scores.set(id, existing)
    })
  }

  addScore(vectorResults, 'vectorScore')
  addScore(bm25Results,   'bm25Score')

  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
}

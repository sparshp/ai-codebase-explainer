export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.java': 'java',
  '.rb': 'ruby',
  '.md': 'markdown',
  '.json': 'json',
}

const BLOCKED_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.min\.(js|css)$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.lockb$/,
  /\.pb\.go$/,
  /prisma\/client\//,
]

const BLOCKED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.wasm', '.zip', '.tar', '.gz', '.bin', '.exe', '.dll',
  '.pdf', '.ttf', '.woff', '.woff2', '.eot',
])

export interface RawFile {
  path:    string
  content: string
  sha:     string
  size:    number
  language?: string
}

export function filterFiles(files: RawFile[]): RawFile[] {
  return files
    .filter(f => {
      // block by pattern
      if (BLOCKED_PATTERNS.some(p => p.test(f.path))) return false
      // block by extension
      const ext = '.' + f.path.split('.').pop()?.toLowerCase()
      if (BLOCKED_EXTENSIONS.has(ext)) return false
      // block files over 500KB
      if (f.size > 500_000) return false
      return true
    })
    .map(f => {
      const ext = '.' + f.path.split('.').pop()?.toLowerCase()
      return { ...f, language: EXTENSION_TO_LANGUAGE[ext] || 'unknown' }
    })
}
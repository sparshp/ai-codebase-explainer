import { RawFile } from '@services/github/github.filter'
import { logger } from '@utils/logger'

export interface ParsedSymbol {
  name:      string
  type:      string        // function | class | method | arrow_function
  startLine: number
  endLine:   number
  body:      string
  docstring?: string
}

export interface ParsedFile {
  path:     string
  language: string
  symbols:  ParsedSymbol[]
  imports:  string[]        // imported file paths
  raw:      string          // full file content
}

// Lazy-load tree-sitter to avoid startup errors if native bindings missing
function tryParseWithTreeSitter(
  content: string,
  language: string
): ParsedSymbol[] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Parser = require('tree-sitter')
    let Lang
    if (language === 'typescript') {
      Lang = require('tree-sitter-typescript').typescript
    } else if (language === 'javascript') {
      Lang = require('tree-sitter-javascript')
    } else {
      return null  // unsupported language
    }

    const parser = new Parser()
    parser.setLanguage(Lang)
    const tree = parser.parse(content)
    const lines = content.split('\n')
    const symbols: ParsedSymbol[] = []

    function extractNode(node: any, parent?: string) {
      const type = node.type

      const symbolTypes = [
        'function_declaration', 'function_definition',
        'method_definition', 'arrow_function',
        'class_declaration', 'export_statement',
      ]

      if (symbolTypes.includes(type)) {
        const startLine = node.startPosition.row
        const endLine   = node.endPosition.row
        const body      = lines.slice(startLine, endLine + 1).join('\n')

        // Try to get function name
        let name = 'anonymous'
        const nameNode = node.childForFieldName?.('name') || node.namedChildren?.[0]
        if (nameNode?.text) name = nameNode.text

        symbols.push({
          name,
          type,
          startLine,
          endLine,
          body,
        })
      }

      for (const child of node.namedChildren || []) {
        extractNode(child, parent)
      }
    }

    extractNode(tree.rootNode)
    return symbols.length > 0 ? symbols : null

  } catch (err) {
    return null
  }
}

function fallbackParse(content: string, filePath: string): ParsedSymbol[] {
  // Regex-based fallback for function detection
  const symbols: ParsedSymbol[] = []
  const lines = content.split('\n')

  const funcRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/
  const arrowRegex = /^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/
  const classRegex = /^(?:export\s+)?class\s+(\w+)/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(funcRegex) || line.match(arrowRegex) || line.match(classRegex)
    if (match) {
      // Find rough end (next function or end of file)
      let end = i
      for (let j = i + 1; j < Math.min(i + 100, lines.length); j++) {
        if (lines[j].match(funcRegex) || lines[j].match(classRegex)) {
          end = j - 1
          break
        }
        end = j
      }
      symbols.push({
        name:      match[1],
        type:      'function',
        startLine: i,
        endLine:   end,
        body:      lines.slice(i, end + 1).join('\n'),
      })
    }
  }

  return symbols
}

function extractImports(content: string): string[] {
  const imports: string[] = []
  const importRegex = /(?:import|require)\s*(?:\{[^}]*\}|[^'"]*)\s*(?:from)?\s*['"]([^'"]+)['"]/g
  let match
  while ((match = importRegex.exec(content)) !== null) {
    const imp = match[1]
    if (imp.startsWith('.')) imports.push(imp)  // relative imports only
  }
  return [...new Set(imports)]
}

export function parseFile(file: RawFile): ParsedFile {
  let symbols = tryParseWithTreeSitter(file.content, file.language || 'unknown')

  if (!symbols) {
    logger.debug({ path: file.path }, 'Tree-sitter unavailable, using fallback parser')
    symbols = fallbackParse(file.content, file.path)
  }

  // If no symbols found, treat entire file as one symbol
  if (symbols.length === 0) {
    symbols = [{
      name:      'file',
      type:      'file',
      startLine: 0,
      endLine:   file.content.split('\n').length - 1,
      body:      file.content,
    }]
  }

  return {
    path:     file.path,
    language: file.language || 'unknown',
    symbols,
    imports:  extractImports(file.content),
    raw:      file.content,
  }
}

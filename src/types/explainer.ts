// First Principles Explainer types for ActivePaper STEM Edition

export interface ConceptCard {
  id: string
  term: string
  explanation: string
  technicalTerms: ExtractedTerm[]
  depth: number
  timestamp: number
}

export interface ExtractedTerm {
  term: string
  description?: string
  startIndex: number
  endIndex: number
}

export interface ConceptStackState {
  isOpen: boolean
  cards: ConceptCard[]
  breadcrumbs: string[]
  currentDepth: number
  isLoading: boolean
  error: string | null
}

// Parse bold terms from markdown text
// Looks for **term** patterns
export function extractBoldTerms(text: string): ExtractedTerm[] {
  const terms: ExtractedTerm[] = []
  const boldPattern = /\*\*([^*]+)\*\*/g
  let match: RegExpExecArray | null

  while ((match = boldPattern.exec(text)) !== null) {
    terms.push({
      term: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  return terms
}

// Maximum depth for concept drilling
export const MAX_CONCEPT_DEPTH = 10

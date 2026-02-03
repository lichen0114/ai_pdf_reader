import type {
  ContentDetectionResult,
  DetectedEquation,
  DetectedCodeBlock,
  DetectedTechnicalTerm,
} from '../types/modes'

// LaTeX patterns
const DISPLAY_MATH_PATTERN = /\$\$([\s\S]+?)\$\$/g
const INLINE_MATH_PATTERN = /\$([^$\n]+)\$/g
const LATEX_COMMAND_PATTERN = /\\[a-zA-Z]+(?:\{[^}]*\})+/g

// Code block patterns
const CODE_BLOCK_PATTERN = /```(\w+)?\n([\s\S]+?)```/g

// Common STEM terms and patterns for technical term detection
const TECHNICAL_TERM_PATTERNS = [
  // Mathematical terms
  /\b(theorem|lemma|corollary|proposition|definition|proof|axiom|postulate)\b/gi,
  /\b(integral|derivative|differential|gradient|divergence|curl|laplacian)\b/gi,
  /\b(matrix|vector|tensor|eigenvalue|eigenvector|determinant)\b/gi,
  /\b(function|equation|inequality|expression|polynomial|series)\b/gi,

  // Physics terms
  /\b(momentum|velocity|acceleration|force|energy|entropy|enthalpy)\b/gi,
  /\b(quantum|photon|electron|proton|neutron|particle|wave)\b/gi,
  /\b(electromagnetic|gravitational|nuclear|thermodynamic)\b/gi,

  // Chemistry terms
  /\b(molecule|atom|ion|compound|reaction|catalyst|enzyme)\b/gi,
  /\b(oxidation|reduction|equilibrium|concentration|molarity)\b/gi,

  // Computer science terms
  /\b(algorithm|complexity|recursion|iteration|heuristic)\b/gi,
  /\b(array|linked list|tree|graph|hash table|heap|stack|queue)\b/gi,
  /\b(sorting|searching|traversal|optimization|dynamic programming)\b/gi,

  // Biology terms
  /\b(DNA|RNA|protein|cell|membrane|nucleus|mitochondria)\b/gi,
  /\b(gene|chromosome|allele|mutation|transcription|translation)\b/gi,

  // General scientific
  /\b(hypothesis|experiment|observation|analysis|synthesis)\b/gi,
  /\b(correlation|causation|variable|parameter|constant)\b/gi,
]

// Capitalized multi-word phrases (often technical terms)
const CAPITALIZED_PHRASE_PATTERN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g

/**
 * Detect LaTeX equations in text
 */
export function detectEquations(text: string): DetectedEquation[] {
  const equations: DetectedEquation[] = []
  let match: RegExpExecArray | null

  // Detect display math ($$...$$)
  const displayRegex = new RegExp(DISPLAY_MATH_PATTERN.source, 'g')
  while ((match = displayRegex.exec(text)) !== null) {
    equations.push({
      id: `eq-display-${match.index}`,
      latex: match[1].trim(),
      displayMode: true,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  // Detect inline math ($...$)
  const inlineRegex = new RegExp(INLINE_MATH_PATTERN.source, 'g')
  while ((match = inlineRegex.exec(text)) !== null) {
    // Skip if this is part of a display math
    const isInsideDisplay = equations.some(
      eq => eq.displayMode && match!.index >= eq.startIndex && match!.index < eq.endIndex
    )
    if (!isInsideDisplay) {
      equations.push({
        id: `eq-inline-${match.index}`,
        latex: match[1].trim(),
        displayMode: false,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  }

  // Detect standalone LaTeX commands (like \frac{1}{2})
  const commandRegex = new RegExp(LATEX_COMMAND_PATTERN.source, 'g')
  while ((match = commandRegex.exec(text)) !== null) {
    // Skip if already captured as math
    const alreadyCaptured = equations.some(
      eq => match!.index >= eq.startIndex && match!.index < eq.endIndex
    )
    if (!alreadyCaptured) {
      equations.push({
        id: `eq-cmd-${match.index}`,
        latex: match[0],
        displayMode: false,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  }

  return equations.sort((a, b) => a.startIndex - b.startIndex)
}

/**
 * Detect code blocks in text
 */
export function detectCodeBlocks(text: string): DetectedCodeBlock[] {
  const codeBlocks: DetectedCodeBlock[] = []
  let match: RegExpExecArray | null

  const regex = new RegExp(CODE_BLOCK_PATTERN.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    codeBlocks.push({
      id: `code-${match.index}`,
      code: match[2].trim(),
      language: match[1] || null,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  return codeBlocks
}

/**
 * Detect technical terms in text using pattern matching
 */
export function detectTechnicalTerms(text: string): DetectedTechnicalTerm[] {
  const terms: DetectedTechnicalTerm[] = []
  const seenTerms = new Set<string>()

  // Check against known technical term patterns
  for (const pattern of TECHNICAL_TERM_PATTERNS) {
    const regex = new RegExp(pattern.source, 'gi')
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const term = match[0]
      const normalizedTerm = term.toLowerCase()

      // Skip duplicates
      if (seenTerms.has(normalizedTerm)) continue
      seenTerms.add(normalizedTerm)

      terms.push({
        id: `term-${match.index}`,
        term,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.9, // High confidence for known patterns
      })
    }
  }

  // Also detect capitalized multi-word phrases
  const phraseRegex = new RegExp(CAPITALIZED_PHRASE_PATTERN.source, 'g')
  let match: RegExpExecArray | null

  while ((match = phraseRegex.exec(text)) !== null) {
    const term = match[0]
    const normalizedTerm = term.toLowerCase()

    // Skip if already detected or common phrases
    if (seenTerms.has(normalizedTerm)) continue
    if (isCommonPhrase(term)) continue

    seenTerms.add(normalizedTerm)

    terms.push({
      id: `term-phrase-${match.index}`,
      term,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      confidence: 0.7, // Medium confidence for capitalized phrases
    })
  }

  return terms.sort((a, b) => a.startIndex - b.startIndex)
}

/**
 * Check if a phrase is a common (non-technical) phrase
 */
function isCommonPhrase(phrase: string): boolean {
  const common = [
    'The', 'In', 'On', 'At', 'For', 'With', 'About', 'From', 'To',
    'New York', 'United States', 'United Kingdom',
  ]
  return common.some(p => phrase.startsWith(p) || phrase === p)
}

/**
 * Detect all interactive content in text
 */
export function detectContent(text: string): ContentDetectionResult {
  return {
    equations: detectEquations(text),
    codeBlocks: detectCodeBlocks(text),
    technicalTerms: detectTechnicalTerms(text),
  }
}

/**
 * Check if a selection contains LaTeX
 */
export function containsLatex(text: string): boolean {
  return DISPLAY_MATH_PATTERN.test(text) ||
         INLINE_MATH_PATTERN.test(text) ||
         LATEX_COMMAND_PATTERN.test(text)
}

/**
 * Check if a selection contains a code block
 */
export function containsCode(text: string): boolean {
  return CODE_BLOCK_PATTERN.test(text)
}

/**
 * Check if a selection likely contains a technical term
 */
export function containsTechnicalTerm(text: string): boolean {
  // Check if text is short enough to be a term (< 100 chars)
  if (text.length > 100) return false

  // Check against known patterns
  for (const pattern of TECHNICAL_TERM_PATTERNS) {
    if (pattern.test(text)) return true
  }

  // Check if it's a capitalized phrase
  if (CAPITALIZED_PHRASE_PATTERN.test(text)) return true

  return false
}

/**
 * Get the type of interactive content detected in a selection
 */
export type SelectionContentType = 'equation' | 'code' | 'term' | 'general'

export function getSelectionContentType(text: string): SelectionContentType {
  if (containsLatex(text)) return 'equation'
  if (containsCode(text)) return 'code'
  if (containsTechnicalTerm(text)) return 'term'
  return 'general'
}

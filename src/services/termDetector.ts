// Fast term detection service for ActivePaper STEM Edition

// Known STEM prefixes and suffixes that indicate technical terms
const TECHNICAL_PREFIXES = [
  'anti', 'auto', 'bio', 'cyber', 'eco', 'electro', 'geo', 'hydro',
  'macro', 'micro', 'nano', 'neuro', 'photo', 'poly', 'pseudo',
  'quasi', 'semi', 'thermo', 'ultra',
]

const TECHNICAL_SUFFIXES = [
  'ation', 'ism', 'ity', 'ment', 'ness', 'ology', 'osis', 'tion',
  'ance', 'ence', 'oid', 'ase', 'ide', 'ine', 'yte',
]

// Common technical term patterns
const TECHNICAL_PATTERNS = [
  // Scientific notation
  /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\s*(?:Hz|kHz|MHz|GHz|nm|mm|cm|m|km|mg|g|kg|ml|L|mol|K|Pa|V|A|W|J|N)\b/i,

  // Chemical formulas
  /\b[A-Z][a-z]?(?:\d+)?(?:[A-Z][a-z]?(?:\d+)?)+\b/,

  // Equations/expressions with Greek letters
  /[αβγδεζηθικλμνξοπρστυφχψω]/i,

  // Acronyms (3+ capitals)
  /\b[A-Z]{3,}\b/,

  // CamelCase technical terms
  /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/,
]

// Cache for previously detected terms per document
const termCache = new Map<string, Map<string, boolean>>()

interface TermDetectionResult {
  isTechnicalTerm: boolean
  confidence: number
  reason?: string
}

/**
 * Fast detection of whether a term is likely technical
 */
export function detectTechnicalTerm(term: string): TermDetectionResult {
  const normalizedTerm = term.trim().toLowerCase()

  // Too short to be meaningful
  if (normalizedTerm.length < 2) {
    return { isTechnicalTerm: false, confidence: 1 }
  }

  // Too long to be a single term
  if (normalizedTerm.length > 100) {
    return { isTechnicalTerm: false, confidence: 0.9 }
  }

  // Check for technical patterns
  for (const pattern of TECHNICAL_PATTERNS) {
    if (pattern.test(term)) {
      return { isTechnicalTerm: true, confidence: 0.9, reason: 'pattern_match' }
    }
  }

  // Check for technical prefixes
  for (const prefix of TECHNICAL_PREFIXES) {
    if (normalizedTerm.startsWith(prefix) && normalizedTerm.length > prefix.length + 3) {
      return { isTechnicalTerm: true, confidence: 0.7, reason: 'prefix_match' }
    }
  }

  // Check for technical suffixes
  for (const suffix of TECHNICAL_SUFFIXES) {
    if (normalizedTerm.endsWith(suffix) && normalizedTerm.length > suffix.length + 3) {
      return { isTechnicalTerm: true, confidence: 0.7, reason: 'suffix_match' }
    }
  }

  // Check for capitalized multi-word phrases
  const words = term.trim().split(/\s+/)
  if (words.length >= 2 && words.length <= 5) {
    const allCapitalized = words.every(w => /^[A-Z]/.test(w))
    if (allCapitalized) {
      return { isTechnicalTerm: true, confidence: 0.6, reason: 'capitalized_phrase' }
    }
  }

  // Check for single capitalized word (potential proper noun or term)
  if (words.length === 1 && /^[A-Z][a-z]+$/.test(term) && term.length > 4) {
    return { isTechnicalTerm: true, confidence: 0.5, reason: 'capitalized_word' }
  }

  // Common words that are definitely NOT technical
  const commonWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
    'those', 'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
    'very', 'just', 'also', 'now', 'then', 'here', 'there', 'however',
    'therefore', 'thus', 'although', 'because', 'since', 'while', 'if',
  ])

  if (commonWords.has(normalizedTerm)) {
    return { isTechnicalTerm: false, confidence: 1 }
  }

  // Default: uncertain, might be technical
  return { isTechnicalTerm: false, confidence: 0.4 }
}

/**
 * Check if a selection is likely a technical term that warrants deep diving
 */
export function shouldShowDeepDive(selection: string): boolean {
  const trimmed = selection.trim()

  // Must be reasonable length for a term
  if (trimmed.length < 3 || trimmed.length > 100) {
    return false
  }

  // Can't be a full sentence (no periods except abbreviations)
  if (/[.!?](?!\s*$)/.test(trimmed)) {
    return false
  }

  // Should be a limited number of words
  const wordCount = trimmed.split(/\s+/).length
  if (wordCount > 5) {
    return false
  }

  const result = detectTechnicalTerm(trimmed)
  return result.isTechnicalTerm || result.confidence < 0.6
}

/**
 * Get or create the term cache for a document
 */
export function getDocumentTermCache(documentId: string): Map<string, boolean> {
  let cache = termCache.get(documentId)
  if (!cache) {
    cache = new Map()
    termCache.set(documentId, cache)
  }
  return cache
}

/**
 * Clear the term cache for a document
 */
export function clearDocumentTermCache(documentId: string): void {
  termCache.delete(documentId)
}

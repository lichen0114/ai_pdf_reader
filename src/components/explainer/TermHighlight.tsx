import { useMemo } from 'react'
import type { ExtractedTerm } from '../../types/explainer'

interface TermHighlightProps {
  text: string
  terms: ExtractedTerm[]
  onTermClick: (term: string) => void
}

interface TextSegment {
  type: 'text' | 'term'
  content: string
  term?: ExtractedTerm
}

/**
 * Renders text with clickable highlighted terms.
 * Bold markdown (**term**) is rendered as clickable buttons.
 */
export default function TermHighlight({ text, terms, onTermClick }: TermHighlightProps) {
  // Parse text into segments
  const segments = useMemo<TextSegment[]>(() => {
    if (terms.length === 0) {
      // No terms to highlight, just return raw text
      // But still need to handle ** markers
      return parseMarkdownBold(text)
    }

    const result: TextSegment[] = []
    let lastIndex = 0

    // Sort terms by start index
    const sortedTerms = [...terms].sort((a, b) => a.startIndex - b.startIndex)

    for (const term of sortedTerms) {
      // Add text before this term
      if (term.startIndex > lastIndex) {
        const beforeText = text.slice(lastIndex, term.startIndex)
        result.push({ type: 'text', content: beforeText })
      }

      // Add the term (without the ** markers)
      result.push({
        type: 'term',
        content: term.term,
        term,
      })

      lastIndex = term.endIndex
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      const afterText = text.slice(lastIndex)
      result.push({ type: 'text', content: afterText })
    }

    return result
  }, [text, terms])

  return (
    <span className="term-highlight-text">
      {segments.map((segment, index) => {
        if (segment.type === 'term') {
          return (
            <button
              key={index}
              onClick={() => onTermClick(segment.content)}
              className="
                inline font-semibold text-amber-400
                hover:text-amber-300 hover:underline
                transition-colors cursor-pointer
                bg-amber-500/10 px-0.5 rounded
              "
              title={`Click to explore: ${segment.content}`}
            >
              {segment.content}
            </button>
          )
        }
        return <span key={index}>{segment.content}</span>
      })}
    </span>
  )
}

/**
 * Simple parser for **bold** markdown when no extracted terms are provided
 */
function parseMarkdownBold(text: string): TextSegment[] {
  const result: TextSegment[] = []
  const pattern = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }

    // Add the bold term
    result.push({
      type: 'term',
      content: match[1],
      term: {
        term: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      },
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return result
}

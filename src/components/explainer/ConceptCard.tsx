import TermHighlight from './TermHighlight'
import type { ConceptCard as ConceptCardType } from '../../types/explainer'

interface ConceptCardProps {
  card: ConceptCardType
  isActive: boolean
  onTermClick: (term: string) => void
}

export default function ConceptCard({ card, isActive, onTermClick }: ConceptCardProps) {
  // Format the explanation with proper line breaks
  const paragraphs = card.explanation.split(/\n\n+/)

  return (
    <div
      className={`
        concept-card p-4 rounded-lg border transition-all duration-200
        ${isActive
          ? 'bg-gray-800/70 border-amber-500/30 shadow-lg'
          : 'bg-gray-800/40 border-gray-700/30 opacity-60 scale-[0.98]'
        }
      `}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 mb-3">
        {/* Depth indicator */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
          {card.depth + 1}
        </div>

        {/* Term title */}
        <h3 className="text-lg font-semibold text-white">
          {card.term}
        </h3>
      </div>

      {/* Explanation content */}
      <div className="prose prose-invert prose-sm max-w-none">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="mb-3 text-gray-200 leading-relaxed">
            <TermHighlight
              text={paragraph}
              terms={card.technicalTerms.filter(t =>
                paragraph.includes(`**${t.term}**`)
              )}
              onTermClick={onTermClick}
            />
          </p>
        ))}
      </div>

      {/* Clickable terms summary */}
      {card.technicalTerms.length > 0 && isActive && (
        <div className="mt-4 pt-3 border-t border-gray-700/50">
          <div className="text-xs text-gray-500 mb-2">
            Click any highlighted term to explore deeper
          </div>
          <div className="flex flex-wrap gap-2">
            {card.technicalTerms.map((term, index) => (
              <button
                key={index}
                onClick={() => onTermClick(term.term)}
                className="
                  px-2 py-1 rounded text-xs
                  bg-amber-500/10 text-amber-400
                  hover:bg-amber-500/20 hover:text-amber-300
                  transition-colors
                "
              >
                {term.term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

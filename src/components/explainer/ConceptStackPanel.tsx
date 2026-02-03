import BreadcrumbNav from './BreadcrumbNav'
import ConceptCard from './ConceptCard'
import type { ConceptCard as ConceptCardType } from '../../types/explainer'

interface ConceptStackPanelProps {
  isOpen: boolean
  cards: ConceptCardType[]
  breadcrumbs: string[]
  isLoading: boolean
  error: string | null
  onTermClick: (term: string) => void
  onNavigate: (index: number) => void
  onClose: () => void
  onBack: () => void
}

export default function ConceptStackPanel({
  isOpen,
  cards,
  breadcrumbs,
  isLoading,
  error,
  onTermClick,
  onNavigate,
  onClose,
  onBack,
}: ConceptStackPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[450px] z-40 flex flex-col bg-gray-900 border-l border-gray-700 shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-3">
          {/* Back button */}
          {cards.length > 0 && (
            <button
              onClick={onBack}
              className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              title="Go back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Title */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-amber-500/20">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">First Principles Explorer</h2>
              <p className="text-xs text-gray-400">Drill down to fundamentals</p>
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Breadcrumbs */}
      <BreadcrumbNav breadcrumbs={breadcrumbs} onNavigate={onNavigate} />

      {/* Card stack */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Previous cards (stacked) */}
        {cards.slice(0, -1).map((card) => (
          <ConceptCard
            key={card.id}
            card={card}
            isActive={false}
            onTermClick={onTermClick}
          />
        ))}

        {/* Current card */}
        {cards.length > 0 && (
          <ConceptCard
            key={cards[cards.length - 1].id}
            card={cards[cards.length - 1]}
            isActive={true}
            onTermClick={onTermClick}
          />
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <svg className="w-8 h-8 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="ml-3 text-gray-400">Exploring concept...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {cards.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-gray-400 mb-2">Select a term to explore</p>
            <p className="text-sm text-gray-500">
              Click "Deep Dive" on any selected text to start
            </p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-gray-700/50 bg-gray-800/30">
        <p className="text-xs text-gray-500 text-center">
          Click highlighted terms in explanations to drill deeper
        </p>
      </div>
    </div>
  )
}

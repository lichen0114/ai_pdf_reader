interface SearchResultsProps {
  results: SearchResults | null
  isLoading: boolean
  selectedIndex: number
  onDocumentClick?: (doc: DocumentSearchResult) => void
  onInteractionClick?: (interaction: InteractionSearchResult) => void
  onConceptClick?: (concept: ConceptSearchResult) => void
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function SearchResults({
  results,
  isLoading,
  selectedIndex,
  onDocumentClick,
  onInteractionClick,
  onConceptClick,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Searching...</span>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <p>Type to search across your library</p>
      </div>
    )
  }

  const totalResults =
    results.documents.length +
    results.interactions.length +
    results.concepts.length

  if (totalResults === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <p>No results found</p>
      </div>
    )
  }

  let globalIndex = 0

  return (
    <div className="space-y-4">
      {/* Documents */}
      {results.documents.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
            Documents ({results.documents.length})
          </h3>
          <div className="space-y-1">
            {results.documents.map((doc) => {
              const isSelected = globalIndex === selectedIndex
              void globalIndex // For future scroll-into-view
              globalIndex++
              return (
                <div
                  key={doc.id}
                  onClick={() => onDocumentClick?.(doc)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-600/30' : 'hover:bg-gray-700/30'}
                  `}
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500">{formatTimeAgo(doc.last_opened_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Interactions */}
      {results.interactions.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
            Interactions ({results.interactions.length})
          </h3>
          <div className="space-y-1">
            {results.interactions.map((interaction) => {
              const isSelected = globalIndex === selectedIndex
              void globalIndex // For future scroll-into-view
              globalIndex++
              return (
                <div
                  key={interaction.id}
                  onClick={() => onInteractionClick?.(interaction)}
                  className={`
                    px-3 py-2 rounded-lg cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-600/30' : 'hover:bg-gray-700/30'}
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`
                      px-1.5 py-0.5 text-xs rounded
                      ${interaction.action_type === 'explain' ? 'bg-yellow-600/30 text-yellow-400' : ''}
                      ${interaction.action_type === 'summarize' ? 'bg-blue-600/30 text-blue-400' : ''}
                      ${interaction.action_type === 'define' ? 'bg-green-600/30 text-green-400' : ''}
                    `}>
                      {interaction.action_type}
                    </span>
                    <span className="text-xs text-gray-500">{interaction.filename}</span>
                  </div>
                  <p
                    className="text-sm text-gray-300 line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: interaction.snippet || interaction.selected_text }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Concepts */}
      {results.concepts.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
            Concepts ({results.concepts.length})
          </h3>
          <div className="flex flex-wrap gap-2 px-2">
            {results.concepts.map((concept) => {
              const isSelected = globalIndex === selectedIndex
              void globalIndex // For future scroll-into-view
              globalIndex++
              return (
                <button
                  key={concept.id}
                  onClick={() => onConceptClick?.(concept)}
                  className={`
                    px-2 py-1 text-sm rounded-full transition-colors
                    ${isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'}
                  `}
                >
                  {concept.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchResults

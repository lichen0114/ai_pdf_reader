import { useRef, useEffect } from 'react'
import type { SearchScope } from '../../hooks/useSearch'

const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'currentPdf', label: 'Current PDF' },
  { value: 'documents', label: 'Library' },
  { value: 'interactions', label: 'Interactions' },
  { value: 'concepts', label: 'Concepts' },
]

interface SearchInputProps {
  query: string
  scope: SearchScope
  onQueryChange: (query: string) => void
  onScopeChange: (scope: SearchScope) => void
  onSearch: () => void
  isLoading: boolean
  totalResults: number
  selectedResultIndex: number
  onNextResult: () => void
  onPreviousResult: () => void
  autoFocus?: boolean
}

function SearchInput({
  query,
  scope,
  onQueryChange,
  onScopeChange,
  onSearch,
  isLoading,
  totalResults,
  selectedResultIndex,
  onNextResult,
  onPreviousResult,
  autoFocus = true,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPreviousResult()
      } else if (totalResults > 0) {
        onNextResult()
      } else {
        onSearch()
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            className="w-full pl-9 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
          />
          {isLoading && (
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        {totalResults > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {selectedResultIndex + 1} / {totalResults}
            </span>
            <button
              onClick={onPreviousResult}
              className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              title="Previous (Shift+Enter)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={onNextResult}
              className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              title="Next (Enter)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Scope tabs */}
      <div className="flex items-center gap-1 text-xs">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onScopeChange(option.value)}
            className={`
              px-2 py-1 rounded transition-colors
              ${scope === option.value
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}
            `}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SearchInput

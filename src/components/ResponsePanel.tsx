import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ResponsePanelProps {
  isOpen: boolean
  response: string
  isLoading: boolean
  error: string | null
  selectedText: string
  onClose: () => void
}

function ResponsePanel({
  isOpen,
  response,
  isLoading,
  error,
  selectedText,
  onClose,
}: ResponsePanelProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as response streams in
  useEffect(() => {
    if (contentRef.current && isLoading) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [response, isLoading])

  if (!isOpen) return null

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-2xl transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-200">AI Response</span>
          {isLoading && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Thinking...
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="px-4 py-3 max-h-80 overflow-y-auto"
      >
        {/* Selected text preview */}
        {selectedText && (
          <div className="mb-3 p-2 bg-gray-700/50 rounded border-l-2 border-blue-400">
            <p className="text-xs text-gray-400 mb-1">Selected text:</p>
            <p className="text-sm text-gray-300 line-clamp-2">{selectedText}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-1 text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Response content */}
        {response && (
          <div className={`markdown-content ${isLoading ? 'typing-cursor' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{response}</ReactMarkdown>
          </div>
        )}

        {/* Empty state while loading */}
        {!response && !error && isLoading && (
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Analyzing your selection...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResponsePanel

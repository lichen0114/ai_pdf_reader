import { useCallback, useEffect, useMemo, useState } from 'react'

interface LibraryViewProps {
  isActive: boolean
  onOpenDocument: (filepath: string) => void
  onOpenDialog: () => void
  limit?: number
  currentWorkspace?: Workspace | null
  onAddToWorkspace?: (documentId: string) => Promise<boolean>
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return `${Math.floor(seconds / 604800)}w ago`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function LibraryView({
  isActive,
  onOpenDocument,
  onOpenDialog,
  limit = 20,
  currentWorkspace,
  onAddToWorkspace,
}: LibraryViewProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    if (!window.api) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await window.api.getRecentDocuments(limit)
      setDocuments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent documents')
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    if (isActive) {
      loadDocuments()
    }
  }, [isActive, loadDocuments])

  const emptyState = useMemo(() => (
    <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
      <svg
        className="w-20 h-20 mb-4 text-gray-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M7 7h10M7 11h10M7 15h6M9 3h6a2 2 0 012 2v14a2 2 0 01-2 2H9a2 2 0 01-2-2V5a2 2 0 012-2z"
        />
      </svg>
      <p className="text-lg text-gray-300 mb-2">No recent PDFs yet</p>
      <p className="text-sm text-gray-500 mb-6">Open a file to start your library.</p>
      <button
        onClick={onOpenDialog}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
      >
        Open PDF
      </button>
    </div>
  ), [onOpenDialog])

  return (
    <div className="h-full bg-zinc-950 overflow-hidden">
      <div className="h-full flex flex-col">
        <header className="px-6 py-4 border-b border-gray-800/70 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Library</h2>
            <p className="text-sm text-gray-400">Recent files</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDocuments}
              className="px-3 py-2 rounded-lg border border-gray-700/70 text-gray-300 text-sm hover:bg-gray-800/60 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={onOpenDialog}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
            >
              Open PDF
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading recent files...</span>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-400 text-sm">
              {error}
            </div>
          ) : documents.length === 0 ? (
            emptyState
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group w-full bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/70 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => onOpenDocument(doc.filepath)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {doc.filename}
                        </span>
                        {doc.total_pages && (
                          <span className="text-xs text-gray-500">
                            {doc.total_pages} pages
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {doc.filepath}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      {currentWorkspace && onAddToWorkspace && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onAddToWorkspace(doc.id)
                          }}
                          className="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-all"
                          title={`Add to ${currentWorkspace.name}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      )}
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTimeAgo(doc.last_opened_at)}
                      </div>
                    </div>
                  </div>
                  <button
                    className="w-full text-left"
                    onClick={() => onOpenDocument(doc.filepath)}
                  >
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <span>Opened {formatDate(doc.last_opened_at)}</span>
                      {doc.scroll_position > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                          Resume ready
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

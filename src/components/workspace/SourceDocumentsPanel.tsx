import type { SourceDocument } from '../../hooks/useConversation'

interface SourceDocumentsPanelProps {
  sources: SourceDocument[]
  onRemove: (documentId: string) => void
  onNavigate?: (documentId: string, pageNumber?: number | null) => void
}

function SourceDocumentsPanel({
  sources,
  onRemove,
  onNavigate,
}: SourceDocumentsPanelProps) {
  if (sources.length === 0) {
    return null
  }

  return (
    <div className="border-t border-gray-700/50 pt-3 mt-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Source Documents ({sources.length})
        </span>
      </div>
      <div className="space-y-1">
        {sources.map((source) => (
          <div
            key={source.id}
            className="group flex items-center gap-2 px-2 py-1.5 rounded bg-gray-700/30 hover:bg-gray-700/50 transition-colors"
          >
            <button
              onClick={() => onNavigate?.(source.documentId, source.pageNumber)}
              className="flex-1 flex items-center gap-2 text-left min-w-0"
              title={source.quotedText || undefined}
            >
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 truncate">{source.fileName}</p>
                {source.pageNumber && (
                  <p className="text-xs text-gray-500">Page {source.pageNumber}</p>
                )}
              </div>
            </button>
            <button
              onClick={() => onRemove(source.documentId)}
              className="p-0.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove source"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SourceDocumentsPanel

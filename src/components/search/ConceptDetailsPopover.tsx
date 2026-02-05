import { useState, useEffect } from 'react'

interface ConceptDocument {
  document_id: string
  filename: string
  occurrence_count: number
}

interface ConceptDetailsPopoverProps {
  concept: ConceptSearchResult
  onClose: () => void
  onDocumentClick?: (filepath: string) => void
}

function ConceptDetailsPopover({
  concept,
  onClose,
  onDocumentClick,
}: ConceptDetailsPopoverProps) {
  const [documents, setDocuments] = useState<ConceptDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDocuments = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const docs = await window.api.getDocumentsForConcept(concept.id)
        setDocuments(docs)
      } catch (err) {
        console.error('Failed to load documents for concept:', err)
        setError('Failed to load documents')
      } finally {
        setIsLoading(false)
      }
    }

    loadDocuments()
  }, [concept.id])

  const handleDocumentClick = async (documentId: string) => {
    if (!onDocumentClick) return
    try {
      const doc = await window.api.getDocumentById(documentId)
      if (doc) {
        onDocumentClick(doc.filepath)
      }
    } catch (err) {
      console.error('Failed to open document:', err)
    }
  }

  const totalOccurrences = documents.reduce((sum, doc) => sum + doc.occurrence_count, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-gray-800 rounded-xl border border-gray-700/50 shadow-2xl p-4 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-200">{concept.name}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {totalOccurrences} occurrence{totalOccurrences !== 1 ? 's' : ''} across {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Documents list */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-4 text-gray-400">
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading...</span>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-400 text-sm">{error}</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">No documents found</div>
          ) : (
            documents.map((doc) => (
              <button
                key={doc.document_id}
                onClick={() => handleDocumentClick(doc.document_id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700/50 transition-colors text-left"
              >
                <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="flex-1 text-sm text-gray-300 truncate">{doc.filename}</span>
                <span className="text-xs text-gray-500 shrink-0">
                  {doc.occurrence_count} mention{doc.occurrence_count !== 1 ? 's' : ''}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ConceptDetailsPopover

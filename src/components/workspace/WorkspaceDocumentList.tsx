interface WorkspaceDocumentListProps {
  documents: Document[]
  currentWorkspace: Workspace | null
  onDocumentClick: (filepath: string) => void
  onRemoveDocument: (documentId: string) => Promise<boolean>
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function WorkspaceDocumentList({
  documents,
  currentWorkspace,
  onDocumentClick,
  onRemoveDocument,
}: WorkspaceDocumentListProps) {
  if (!currentWorkspace) {
    return null
  }

  if (documents.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm mb-2">No documents in this workspace</p>
        <p className="text-xs text-gray-600">
          Add documents from the library view
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700/30 transition-colors"
        >
          <button
            onClick={() => onDocumentClick(doc.filepath)}
            className="flex-1 flex items-center gap-3 text-left min-w-0"
          >
            <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">{doc.filename}</p>
              <p className="text-xs text-gray-500">
                {doc.total_pages ? `${doc.total_pages} pages` : 'Unknown pages'} &middot; {formatDate(doc.last_opened_at)}
              </p>
            </div>
          </button>
          <button
            onClick={() => onRemoveDocument(doc.id)}
            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove from workspace"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

export default WorkspaceDocumentList

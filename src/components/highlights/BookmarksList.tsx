import type { BookmarkData } from '../../hooks/useBookmarks'

interface BookmarksListProps {
  isOpen: boolean
  bookmarks: BookmarkData[]
  currentPage: number
  onBookmarkClick: (pageNumber: number) => void
  onBookmarkDelete: (id: string) => void
  onClose: () => void
}

function BookmarksList({
  isOpen,
  bookmarks,
  currentPage,
  onBookmarkClick,
  onBookmarkDelete,
  onClose,
}: BookmarksListProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 z-10"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute left-4 top-16 bottom-20 w-64 bg-gray-800 rounded-lg shadow-2xl border border-gray-700/50 z-20 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <h3 className="font-medium text-gray-100">Bookmarks</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {bookmarks.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              <p>No bookmarks yet</p>
              <p className="mt-1 text-xs text-gray-500">
                Click the bookmark icon on a page to add one
              </p>
            </div>
          ) : (
            <div className="py-2">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className={`
                    group flex items-center gap-3 px-4 py-2 cursor-pointer
                    ${currentPage === bookmark.page_number ? 'bg-blue-600/20' : 'hover:bg-gray-700/30'}
                    transition-colors
                  `}
                  onClick={() => onBookmarkClick(bookmark.page_number)}
                >
                  <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200">
                      Page {bookmark.page_number}
                    </p>
                    {bookmark.label && (
                      <p className="text-xs text-gray-400 truncate">
                        {bookmark.label}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onBookmarkDelete(bookmark.id)
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-600/30 rounded text-gray-400 hover:text-red-400 transition-all"
                    title="Delete bookmark"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default BookmarksList

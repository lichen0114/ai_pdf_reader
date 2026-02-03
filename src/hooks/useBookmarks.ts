import { useState, useCallback, useEffect } from 'react'

export interface BookmarkData {
  id: string
  document_id: string
  page_number: number
  label: string | null
  created_at: number
}

export function useBookmarks(documentId: string | null) {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load bookmarks when document changes
  useEffect(() => {
    if (!documentId) {
      setBookmarks([])
      return
    }

    const loadBookmarks = async () => {
      setIsLoading(true)
      try {
        const data = await window.api.getBookmarksByDocument(documentId)
        setBookmarks(data)
      } catch (error) {
        console.error('Failed to load bookmarks:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadBookmarks()
  }, [documentId])

  const toggleBookmark = useCallback(async (
    pageNumber: number,
    label?: string
  ): Promise<BookmarkData | null> => {
    if (!documentId) return null

    try {
      const result = await window.api.toggleBookmark({
        document_id: documentId,
        page_number: pageNumber,
        label,
      })

      if (result) {
        // Bookmark was added
        setBookmarks(prev => [...prev, result].sort((a, b) => a.page_number - b.page_number))
        return result
      } else {
        // Bookmark was removed
        setBookmarks(prev => prev.filter(b => b.page_number !== pageNumber))
        return null
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
      return null
    }
  }, [documentId])

  const updateLabel = useCallback(async (id: string, label: string | null): Promise<boolean> => {
    try {
      const success = await window.api.updateBookmarkLabel(id, label)
      if (success) {
        setBookmarks(prev => prev.map(b => b.id === id ? { ...b, label } : b))
      }
      return success
    } catch (error) {
      console.error('Failed to update bookmark label:', error)
      return false
    }
  }, [])

  const deleteBookmark = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await window.api.deleteBookmark(id)
      if (success) {
        setBookmarks(prev => prev.filter(b => b.id !== id))
      }
      return success
    } catch (error) {
      console.error('Failed to delete bookmark:', error)
      return false
    }
  }, [])

  const isPageBookmarked = useCallback((pageNumber: number): boolean => {
    return bookmarks.some(b => b.page_number === pageNumber)
  }, [bookmarks])

  const getBookmarkForPage = useCallback((pageNumber: number): BookmarkData | undefined => {
    return bookmarks.find(b => b.page_number === pageNumber)
  }, [bookmarks])

  return {
    bookmarks,
    isLoading,
    toggleBookmark,
    updateLabel,
    deleteBookmark,
    isPageBookmarked,
    getBookmarkForPage,
  }
}

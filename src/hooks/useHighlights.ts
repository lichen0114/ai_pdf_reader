import { useState, useCallback, useEffect } from 'react'

export interface HighlightData {
  id: string
  document_id: string
  page_number: number
  start_offset: number
  end_offset: number
  selected_text: string
  color: HighlightColor
  note: string | null
  created_at: number
  updated_at: number
}

export function useHighlights(documentId: string | null) {
  const [highlights, setHighlights] = useState<HighlightData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load highlights when document changes
  useEffect(() => {
    if (!documentId) {
      setHighlights([])
      setError(null)
      return
    }

    const loadHighlights = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await window.api.getHighlightsByDocument(documentId)
        setHighlights(data as HighlightData[])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load highlights'
        console.error('Failed to load highlights:', err)
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    loadHighlights()
  }, [documentId])

  const createHighlight = useCallback(async (
    pageNumber: number,
    startOffset: number,
    endOffset: number,
    selectedText: string,
    color: HighlightColor = 'yellow',
    note?: string
  ): Promise<HighlightData | null> => {
    if (!documentId) return null

    setError(null)
    try {
      const highlight = await window.api.createHighlight({
        document_id: documentId,
        page_number: pageNumber,
        start_offset: startOffset,
        end_offset: endOffset,
        selected_text: selectedText,
        color,
        note,
      })

      setHighlights(prev => [...prev, highlight as HighlightData])
      return highlight as HighlightData
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create highlight'
      console.error('Failed to create highlight:', err)
      setError(message)
      return null
    }
  }, [documentId])

  const updateHighlight = useCallback(async (
    id: string,
    updates: { color?: HighlightColor; note?: string }
  ): Promise<HighlightData | null> => {
    setError(null)
    try {
      const updated = await window.api.updateHighlight({ id, ...updates })
      if (updated) {
        setHighlights(prev => prev.map(h => h.id === id ? updated as HighlightData : h))
        return updated as HighlightData
      }
      return null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update highlight'
      console.error('Failed to update highlight:', err)
      setError(message)
      return null
    }
  }, [])

  const deleteHighlight = useCallback(async (id: string): Promise<boolean> => {
    setError(null)
    try {
      const success = await window.api.deleteHighlight(id)
      if (success) {
        setHighlights(prev => prev.filter(h => h.id !== id))
      }
      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete highlight'
      console.error('Failed to delete highlight:', err)
      setError(message)
      return false
    }
  }, [])

  const getHighlightsForPage = useCallback((pageNumber: number): HighlightData[] => {
    return highlights.filter(h => h.page_number === pageNumber)
  }, [highlights])

  const clearError = useCallback(() => setError(null), [])

  return {
    highlights,
    isLoading,
    error,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getHighlightsForPage,
    clearError,
  }
}

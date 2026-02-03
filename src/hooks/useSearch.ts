import { useState, useCallback } from 'react'

export type SearchScope = 'all' | 'documents' | 'interactions' | 'concepts' | 'currentPdf'

export interface SearchState {
  query: string
  scope: SearchScope
  isLoading: boolean
  results: SearchResults | null
  pdfMatches: PDFSearchMatch[]
  selectedResultIndex: number
}

export interface PDFSearchMatch {
  pageNumber: number
  text: string
  index: number
}

export function useSearch(documentId?: string | null) {
  const [state, setState] = useState<SearchState>({
    query: '',
    scope: 'all',
    isLoading: false,
    results: null,
    pdfMatches: [],
    selectedResultIndex: 0,
  })

  const setQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, query }))
  }, [])

  const setScope = useCallback((scope: SearchScope) => {
    setState(prev => ({ ...prev, scope, results: null, pdfMatches: [] }))
  }, [])

  const search = useCallback(async () => {
    const { query, scope } = state
    if (!query.trim()) {
      setState(prev => ({ ...prev, results: null, pdfMatches: [] }))
      return
    }

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      if (scope === 'currentPdf') {
        // PDF content search is handled locally (not via database)
        // The actual text matching is done in the component
        setState(prev => ({ ...prev, isLoading: false }))
        return
      }

      let results: SearchResults | null = null

      if (scope === 'all') {
        results = await window.api.searchAll(query)
      } else if (scope === 'documents') {
        const documents = await window.api.searchDocuments(query)
        results = { documents, interactions: [], concepts: [] }
      } else if (scope === 'interactions') {
        const interactions = documentId
          ? await window.api.searchInteractionsInDocument(documentId, query)
          : await window.api.searchInteractions(query)
        results = { documents: [], interactions, concepts: [] }
      } else if (scope === 'concepts') {
        const concepts = await window.api.searchConcepts(query)
        results = { documents: [], interactions: [], concepts }
      }

      setState(prev => ({ ...prev, results, isLoading: false }))
    } catch (error) {
      console.error('Search failed:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [state.query, state.scope, documentId])

  const setPdfMatches = useCallback((matches: PDFSearchMatch[]) => {
    setState(prev => ({ ...prev, pdfMatches: matches, selectedResultIndex: 0 }))
  }, [])

  const selectNextResult = useCallback(() => {
    setState(prev => {
      const totalResults = getTotalResults(prev)
      if (totalResults === 0) return prev
      return { ...prev, selectedResultIndex: (prev.selectedResultIndex + 1) % totalResults }
    })
  }, [])

  const selectPreviousResult = useCallback(() => {
    setState(prev => {
      const totalResults = getTotalResults(prev)
      if (totalResults === 0) return prev
      return { ...prev, selectedResultIndex: (prev.selectedResultIndex - 1 + totalResults) % totalResults }
    })
  }, [])

  const clearSearch = useCallback(() => {
    setState({
      query: '',
      scope: 'all',
      isLoading: false,
      results: null,
      pdfMatches: [],
      selectedResultIndex: 0,
    })
  }, [])

  return {
    ...state,
    setQuery,
    setScope,
    search,
    setPdfMatches,
    selectNextResult,
    selectPreviousResult,
    clearSearch,
    totalResults: getTotalResults(state),
  }
}

function getTotalResults(state: SearchState): number {
  if (state.scope === 'currentPdf') {
    return state.pdfMatches.length
  }
  if (!state.results) return 0
  return (
    state.results.documents.length +
    state.results.interactions.length +
    state.results.concepts.length
  )
}

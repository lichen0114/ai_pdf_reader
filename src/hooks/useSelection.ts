import { useState, useEffect, useCallback, useRef } from 'react'

interface SelectionState {
  selectedText: string
  pageContext: string
  pageNumber: number | null
}

export function useSelection() {
  const [state, setState] = useState<SelectionState>({
    selectedText: '',
    pageContext: '',
    pageNumber: null,
  })

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleSelectionChange = useCallback(() => {
    // Debounce selection changes
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        return
      }

      const text = selection.toString().trim()
      if (!text) {
        return
      }

      // Try to get page context
      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer

      // Find the page container
      let pageElement: HTMLElement | null = null
      let node: Node | null = container
      while (node && !(node as HTMLElement).classList?.contains('pdf-page')) {
        node = node.parentNode
        if (node && node instanceof HTMLElement) {
          pageElement = node
        }
      }

      // Get surrounding context
      let context = ''
      let pageNumber: number | null = null

      if (pageElement) {
        // Get all text from the text layer
        const textLayer = pageElement.querySelector('.textLayer')
        if (textLayer) {
          context = textLayer.textContent?.slice(0, 2000) || ''
        }

        // Try to get page number from data attribute
        const pageNum = pageElement.getAttribute('data-page-number')
        if (pageNum) {
          pageNumber = parseInt(pageNum, 10)
        }
      } else {
        // Fallback: get surrounding text from the selection
        const parent = container.parentElement
        if (parent) {
          context = parent.textContent?.slice(0, 1000) || ''
        }
      }

      setState({
        selectedText: text,
        pageContext: context,
        pageNumber,
      })
    }, 300)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [handleSelectionChange])

  const clearSelection = useCallback(() => {
    setState({
      selectedText: '',
      pageContext: '',
      pageNumber: null,
    })
    window.getSelection()?.removeAllRanges()
  }, [])

  return {
    selectedText: state.selectedText,
    pageContext: state.pageContext,
    pageNumber: state.pageNumber,
    clearSelection,
  }
}

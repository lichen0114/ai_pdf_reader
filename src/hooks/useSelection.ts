import { useState, useEffect, useCallback, useRef } from 'react'

interface SelectionState {
  selectedText: string
  pageContext: string
  pageNumber: number | null
  selectionRect: DOMRect | null
  startOffset: number | null
  endOffset: number | null
}

export function useSelection() {
  const [state, setState] = useState<SelectionState>({
    selectedText: '',
    pageContext: '',
    pageNumber: null,
    selectionRect: null,
    startOffset: null,
    endOffset: null,
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
      let startOffset: number | null = null
      let endOffset: number | null = null

      if (pageElement) {
        // Get all text from the text layer
        const textLayer = pageElement.querySelector('.textLayer')
        if (textLayer) {
          context = textLayer.textContent?.slice(0, 2000) || ''

          // Calculate character offsets within the text layer
          const offsets = calculateOffsets(textLayer, range)
          startOffset = offsets.start
          endOffset = offsets.end
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

      // Get bounding rect for the selection
      const selectionRect = range.getBoundingClientRect()

      setState({
        selectedText: text,
        pageContext: context,
        pageNumber,
        selectionRect,
        startOffset,
        endOffset,
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
      selectionRect: null,
      startOffset: null,
      endOffset: null,
    })
    window.getSelection()?.removeAllRanges()
  }, [])

  // Clear selectionRect on scroll (position becomes stale)
  useEffect(() => {
    const handleScroll = () => {
      if (state.selectionRect) {
        setState(prev => ({ ...prev, selectionRect: null }))
      }
    }

    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [state.selectionRect])

  return {
    selectedText: state.selectedText,
    pageContext: state.pageContext,
    pageNumber: state.pageNumber,
    selectionRect: state.selectionRect,
    startOffset: state.startOffset,
    endOffset: state.endOffset,
    clearSelection,
  }
}

// Calculate character offsets of selection within text layer
function calculateOffsets(textLayer: Element, range: Range): { start: number; end: number } {
  let start = 0
  let end = 0
  let currentOffset = 0
  let foundStart = false
  let foundEnd = false

  const spans = textLayer.querySelectorAll('span')

  for (const span of spans) {
    const text = span.textContent || ''
    const spanLength = text.length

    // Check if range starts in this span
    if (!foundStart && range.startContainer === span.firstChild) {
      start = currentOffset + range.startOffset
      foundStart = true
    } else if (!foundStart && span.contains(range.startContainer)) {
      // Range starts in a nested element
      start = currentOffset + range.startOffset
      foundStart = true
    }

    // Check if range ends in this span
    if (!foundEnd && range.endContainer === span.firstChild) {
      end = currentOffset + range.endOffset
      foundEnd = true
    } else if (!foundEnd && span.contains(range.endContainer)) {
      // Range ends in a nested element
      end = currentOffset + range.endOffset
      foundEnd = true
    }

    if (foundStart && foundEnd) break
    currentOffset += spanLength
  }

  // If we couldn't find the offsets precisely, estimate from the selected text
  if (!foundStart || !foundEnd) {
    const fullText = textLayer.textContent || ''
    const selectedText = range.toString()
    const searchStart = start || 0
    const foundIndex = fullText.indexOf(selectedText, searchStart)
    if (foundIndex !== -1) {
      start = foundIndex
      end = foundIndex + selectedText.length
    }
  }

  return { start, end }
}

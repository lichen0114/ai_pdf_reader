import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import HighlightLayer from './highlights/HighlightLayer'
import BookmarkIndicator from './highlights/BookmarkIndicator'
import InteractiveZoneOverlay from './modes/InteractiveZoneOverlay'
import type { HighlightData } from '../hooks/useHighlights'
import { useContentDetection } from '../hooks/useContentDetection'
import type { InteractiveZone, UIMode } from '../types/modes'
import type { PDFOutlineItem } from '../types/pdf'

// Set worker source using Vite's ?url import for reliable path resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

export interface TextLayerInfo {
  container: HTMLElement
  textContent: string
  scale: number
}

export interface PDFViewerRef {
  goToPage: (page: number) => void
  getCurrentPage: () => number
  getTotalPages: () => number
  getTextLayerInfo: (pageNumber: number) => TextLayerInfo | null
  getPageText: (pageNumber: number) => Promise<string | null>
  getOutline: () => Promise<PDFOutlineItem[]>
  renderThumbnail: (pageNumber: number, targetWidth?: number) => Promise<string | null>
}

interface PDFViewerProps {
  data: ArrayBuffer
  initialScrollPosition?: number
  initialScale?: number
  onScrollChange?: (scrollTop: number) => void
  onScaleChange?: (scale: number) => void
  onError?: (message: string) => void
  highlights?: HighlightData[]
  onUpdateHighlight?: (id: string, updates: { color?: HighlightColor; note?: string }) => void
  onDeleteHighlight?: (id: string) => void
  bookmarkedPages?: Set<number>
  onToggleBookmark?: (pageNumber: number) => void
  onPageChange?: (pageNumber: number) => void
  onTotalPagesChange?: (totalPages: number) => void
  // Investigate mode
  mode?: UIMode
  onZoneClick?: (zone: InteractiveZone) => void
}

const SCALE_DEFAULT = 1.5
const SCALE_MIN = 0.5
const SCALE_MAX = 3.0
const SCALE_STEP = 0.25

const PDFViewerInner = forwardRef<PDFViewerRef, PDFViewerProps>(function PDFViewer({
  data,
  initialScrollPosition,
  initialScale,
  onScrollChange,
  onScaleChange,
  onError,
  highlights = [],
  onUpdateHighlight,
  onDeleteHighlight,
  bookmarkedPages = new Set(),
  onToggleBookmark,
  onPageChange,
  onTotalPagesChange,
  mode = 'reading',
  onZoneClick,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [scale, setScale] = useState(initialScale ?? SCALE_DEFAULT)
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialScrollApplied = useRef(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())
  const [pageInput, setPageInput] = useState('1')
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const textLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  // LRU text content cache - limit to 50 pages to prevent memory growth on large PDFs
  const textContentCache = useRef<Map<number, string>>(new Map())
  const textCacheOrderRef = useRef<number[]>([])
  const MAX_TEXT_CACHE_SIZE = 50

  // Canvas LRU cache - keep rendered canvases in memory for instant scroll-back
  const canvasCacheRef = useRef<Map<number, { canvas: HTMLCanvasElement; textLayer: HTMLDivElement }>>(new Map())
  const canvasCacheOrderRef = useRef<number[]>([])
  const MAX_CANVAS_CACHE_SIZE = 15 // ~30-150MB depending on page size

  // Scroll direction tracking for smarter pre-rendering
  const lastScrollTopRef = useRef(0)
  const scrollDirectionRef = useRef<'down' | 'up'>('down')

  const renderingRef = useRef<Set<number>>(new Set())
  const renderedPagesRef = useRef<Set<number>>(new Set())
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null)
  const renderTasksRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map())
  const scaleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderScaleRef = useRef(SCALE_DEFAULT)
  const prevScaleRef = useRef(SCALE_DEFAULT)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(scale)
  const totalPagesRef = useRef(totalPages)

  // Keep refs in sync for stable callbacks
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    totalPagesRef.current = totalPages
  }, [totalPages])

  // Content detection for investigate mode
  const isInvestigateMode = mode === 'investigate'
  const {
    zones,
    detectPageContent,
    updateZoneBounds,
    clearAll: clearContentDetection,
  } = useContentDetection({ enabled: isInvestigateMode })

  // Helper to add to text cache with LRU eviction
  const addToTextCache = useCallback((pageNumber: number, text: string) => {
    // If already in cache, move to end (most recently used)
    const existingIndex = textCacheOrderRef.current.indexOf(pageNumber)
    if (existingIndex !== -1) {
      textCacheOrderRef.current.splice(existingIndex, 1)
    }
    textCacheOrderRef.current.push(pageNumber)

    // Evict oldest entries if cache is too large
    while (textCacheOrderRef.current.length > MAX_TEXT_CACHE_SIZE) {
      const oldest = textCacheOrderRef.current.shift()
      if (oldest !== undefined) {
        textContentCache.current.delete(oldest)
      }
    }

    textContentCache.current.set(pageNumber, text)
  }, [])

  const getPageText = useCallback(async (pageNumber: number): Promise<string | null> => {
    const cached = textContentCache.current.get(pageNumber)
    if (cached) {
      // Move to end of LRU order
      const index = textCacheOrderRef.current.indexOf(pageNumber)
      if (index !== -1) {
        textCacheOrderRef.current.splice(index, 1)
        textCacheOrderRef.current.push(pageNumber)
      }
      return cached
    }
    const doc = pdfRef.current
    if (!doc) return null
    try {
      const page = await doc.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const fullText = textContent.items.map((item: any) => item.str || '').join('')
      addToTextCache(pageNumber, fullText)
      return fullText
    } catch (err) {
      console.error('Failed to get page text:', err)
      return null
    }
  }, [addToTextCache])

  const resolveDestPageNumber = useCallback(async (
    doc: pdfjsLib.PDFDocumentProxy,
    dest: any
  ): Promise<number | null> => {
    try {
      let destArray = dest
      if (typeof dest === 'string') {
        destArray = await doc.getDestination(dest)
      }
      if (!Array.isArray(destArray) || destArray.length === 0) return null
      const [ref] = destArray
      if (!ref) return null
      const pageIndex = await doc.getPageIndex(ref)
      return pageIndex + 1
    } catch (err) {
      console.warn('Failed to resolve outline destination:', err)
      return null
    }
  }, [])

  const resolveOutlineItem = useCallback(async (
    doc: pdfjsLib.PDFDocumentProxy,
    item: any
  ): Promise<PDFOutlineItem> => {
    const pageNumber = await resolveDestPageNumber(doc, item.dest)
    const children = item.items
      ? await Promise.all(item.items.map((child: any) => resolveOutlineItem(doc, child)))
      : []
    return {
      title: item.title || 'Untitled',
      pageNumber,
      items: children,
    }
  }, [resolveDestPageNumber])

  const getOutline = useCallback(async (): Promise<PDFOutlineItem[]> => {
    const doc = pdfRef.current
    if (!doc) return []
    try {
      const outline = await doc.getOutline()
      if (!outline || outline.length === 0) return []
      return Promise.all(outline.map((item: any) => resolveOutlineItem(doc, item)))
    } catch (err) {
      console.error('Failed to load outline:', err)
      return []
    }
  }, [resolveOutlineItem])

  const renderThumbnail = useCallback(async (
    pageNumber: number,
    targetWidth: number = 140
  ): Promise<string | null> => {
    const doc = pdfRef.current
    if (!doc) return null
    try {
      const page = await doc.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = targetWidth / baseViewport.width
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const outputScale = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const context = canvas.getContext('2d')
      if (!context) return null
      context.scale(outputScale, outputScale)
      const renderTask = page.render({
        canvasContext: context,
        viewport,
      })
      await renderTask.promise
      return canvas.toDataURL('image/png')
    } catch (err) {
      console.error('Failed to render thumbnail:', err)
      return null
    }
  }, [])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    goToPage: (page: number) => goToPage(page),
    getCurrentPage: () => currentPage,
    getTotalPages: () => totalPages,
    getTextLayerInfo: (pageNumber: number): TextLayerInfo | null => {
      const textLayer = textLayerRefs.current.get(pageNumber)
      if (!textLayer) return null
      return {
        container: textLayer,
        textContent: textContentCache.current.get(pageNumber) || '',
        scale,
      }
    },
    getPageText,
    getOutline,
    renderThumbnail,
  }), [currentPage, totalPages, scale, getPageText, getOutline, renderThumbnail])

  // Cancel all in-flight render tasks
  const cancelAllRenderTasks = useCallback(() => {
    for (const [, task] of renderTasksRef.current) {
      task.cancel()
    }
    renderTasksRef.current.clear()
    renderingRef.current.clear()
  }, [])

  // Load PDF document
  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      console.log('Loading PDF, data length:', data.byteLength)

      // Cancel any in-flight render tasks from previous PDF
      cancelAllRenderTasks()

      // Cancel previous loading task if still in progress
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy()
        loadingTaskRef.current = null
      }

      // Destroy previous PDF document
      if (pdfRef.current) {
        pdfRef.current.destroy()
        pdfRef.current = null
      }

      try {
        // Clone the ArrayBuffer to prevent detachment issues when PDF.js transfers it to the worker
        const dataClone = data.slice(0)
        const loadingTask = pdfjsLib.getDocument({
          data: dataClone,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
        })
        loadingTaskRef.current = loadingTask
        const pdfDoc = await loadingTask.promise
        console.log('PDF loaded, pages:', pdfDoc.numPages)

        if (!cancelled) {
          pdfRef.current = pdfDoc
          setPdf(pdfDoc)
          setTotalPages(pdfDoc.numPages)
          setRenderedPages(new Set())
          renderedPagesRef.current.clear()
          renderingRef.current.clear()
          pageRefs.current.clear()
          textLayerRefs.current.clear()
          textContentCache.current.clear()
          // Clear canvas cache for new PDF
          canvasCacheRef.current.clear()
          canvasCacheOrderRef.current = []
          renderScaleRef.current = scale
        } else {
          // If cancelled, destroy the loaded document
          pdfDoc.destroy()
        }
      } catch (err) {
        // Ignore cancellation errors
        if (err instanceof Error && err.message.includes('destroy')) {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to load PDF'
        console.error('Failed to load PDF:', err)
        onError?.(message)
      }
    }

    loadPdf()

    return () => {
      cancelled = true
      // Cancel the in-flight loading task to prevent orphaned PDF objects
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy()
        loadingTaskRef.current = null
      }
      pageRefs.current.clear()
    }
  }, [data, cancelAllRenderTasks])

  // Render a single page - uses refs for stable callback
  const renderPage = useCallback(
    async (pageNum: number, container: HTMLDivElement) => {
      const currentPdf = pdfRef.current
      const currentScale = scaleRef.current
      if (!currentPdf || renderingRef.current.has(pageNum)) return
      // Skip if already rendered (canvas exists)
      if (container.querySelector('canvas')) return

      // Check canvas cache first - instant restore for previously rendered pages
      const cached = canvasCacheRef.current.get(pageNum)
      if (cached && renderScaleRef.current === currentScale) {
        container.innerHTML = ''
        const clonedCanvas = cached.canvas.cloneNode(true) as HTMLCanvasElement
        const ctx = clonedCanvas.getContext('2d')
        ctx?.drawImage(cached.canvas, 0, 0) // Copy pixel data
        container.appendChild(clonedCanvas)

        const clonedTextLayer = cached.textLayer.cloneNode(true) as HTMLDivElement
        container.appendChild(clonedTextLayer)
        textLayerRefs.current.set(pageNum, clonedTextLayer)

        // Update dimensions
        container.style.width = clonedCanvas.style.width
        container.style.height = clonedCanvas.style.height
        const parentDiv = container.parentElement
        if (parentDiv) {
          parentDiv.style.width = clonedCanvas.style.width
          parentDiv.style.height = clonedCanvas.style.height
        }

        // Update LRU order
        const existingIdx = canvasCacheOrderRef.current.indexOf(pageNum)
        if (existingIdx !== -1) {
          canvasCacheOrderRef.current.splice(existingIdx, 1)
        }
        canvasCacheOrderRef.current.push(pageNum)

        renderedPagesRef.current.add(pageNum)
        setRenderedPages(prev => new Set([...prev, pageNum]))
        return
      }

      renderingRef.current.add(pageNum)

      try {
        const page = await currentPdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: currentScale })

        // Clear container (safe now since React doesn't manage children of this element)
        container.innerHTML = ''
        container.style.width = `${viewport.width}px`
        container.style.height = `${viewport.height}px`

        // Update parent container to match page dimensions (prevents overlap)
        const parentDiv = container.parentElement
        if (parentDiv) {
          parentDiv.style.width = `${viewport.width}px`
          parentDiv.style.height = `${viewport.height}px`
        }

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width * window.devicePixelRatio
        canvas.height = viewport.height * window.devicePixelRatio
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        container.appendChild(canvas)

        const context = canvas.getContext('2d')!
        context.scale(window.devicePixelRatio, window.devicePixelRatio)

        // Render page and track the task for cancellation
        const renderTask = page.render({
          canvasContext: context,
          viewport,
        })
        renderTasksRef.current.set(pageNum, renderTask)

        await renderTask.promise

        // Remove from tracking after completion
        renderTasksRef.current.delete(pageNum)

        // Create text layer
        const textContent = await page.getTextContent()
        const textLayer = document.createElement('div')
        textLayer.className = 'textLayer'
        textLayer.style.width = `${viewport.width}px`
        textLayer.style.height = `${viewport.height}px`
        textLayer.style.setProperty('--scale-factor', currentScale.toString())
        container.appendChild(textLayer)

        // Render text layer using new API
        const textLayerInstance = new TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport,
        })
        await textLayerInstance.render()

        // Store text layer reference and text content for highlights (with LRU cache)
        textLayerRefs.current.set(pageNum, textLayer)
        const fullText = textContent.items.map((item: any) => item.str || '').join('')
        addToTextCache(pageNum, fullText)

        // Run content detection for investigate mode
        if (isInvestigateMode) {
          detectPageContent(pageNum, fullText)
          // Defer zone bounds update to allow text layer layout
          requestAnimationFrame(() => {
            updateZoneBounds(pageNum, textLayer)
          })
        }

        // Cache the rendered canvas and text layer for instant scroll-back
        const canvasClone = document.createElement('canvas')
        canvasClone.width = canvas.width
        canvasClone.height = canvas.height
        canvasClone.style.width = canvas.style.width
        canvasClone.style.height = canvas.style.height
        const cloneCtx = canvasClone.getContext('2d')
        cloneCtx?.drawImage(canvas, 0, 0)

        const textLayerClone = textLayer.cloneNode(true) as HTMLDivElement

        // LRU cache management
        const existingIdx = canvasCacheOrderRef.current.indexOf(pageNum)
        if (existingIdx !== -1) {
          canvasCacheOrderRef.current.splice(existingIdx, 1)
        }
        canvasCacheOrderRef.current.push(pageNum)

        while (canvasCacheOrderRef.current.length > MAX_CANVAS_CACHE_SIZE) {
          const oldest = canvasCacheOrderRef.current.shift()
          if (oldest !== undefined) canvasCacheRef.current.delete(oldest)
        }

        canvasCacheRef.current.set(pageNum, { canvas: canvasClone, textLayer: textLayerClone })

        // Update ref immediately (synchronous tracking)
        renderedPagesRef.current.add(pageNum)
        // Update state for UI (triggers spinner hide)
        setRenderedPages((prev) => new Set([...prev, pageNum]))
      } catch (err) {
        // Ignore cancellation errors
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
          return
        }
        console.error(`Failed to render page ${pageNum}:`, err)
      } finally {
        renderingRef.current.delete(pageNum)
        renderTasksRef.current.delete(pageNum)
      }
    },
    [isInvestigateMode, detectPageContent, updateZoneBounds, addToTextCache] // Removed pdf/scale - using refs
  )

  // Handle scroll to detect visible pages - uses refs for stable callback
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !pdfRef.current) return

    const container = containerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    const currentTotalPages = totalPagesRef.current

    // Track scroll direction for smarter pre-rendering
    const direction = scrollTop > lastScrollTopRef.current ? 'down' : 'up'
    scrollDirectionRef.current = direction
    lastScrollTopRef.current = scrollTop

    // Find current page based on scroll position
    let accumulatedHeight = 0
    for (let i = 1; i <= currentTotalPages; i++) {
      const pageDiv = pageRefs.current.get(i)
      if (pageDiv) {
        const pageHeight = pageDiv.offsetHeight + 16 // margin
        if (scrollTop < accumulatedHeight + pageHeight / 2) {
          setCurrentPage(i)
          break
        }
        accumulatedHeight += pageHeight
      }
    }

    // Adjust buffer based on scroll direction - pre-render more in the direction of travel
    const bufferAbove = direction === 'down' ? containerHeight * 0.5 : containerHeight * 1.5
    const bufferBelow = direction === 'down' ? containerHeight * 2.5 : containerHeight * 1.5

    // Render visible pages with direction-aware buffering
    const visibleStart = scrollTop - bufferAbove
    const visibleEnd = scrollTop + containerHeight + bufferBelow

    accumulatedHeight = 0
    for (let i = 1; i <= currentTotalPages; i++) {
      const pageDiv = pageRefs.current.get(i)
      if (pageDiv) {
        const pageHeight = pageDiv.offsetHeight + 16
        const pageTop = accumulatedHeight
        const pageBottom = accumulatedHeight + pageHeight

        if (pageBottom >= visibleStart && pageTop <= visibleEnd) {
          if (!renderedPagesRef.current.has(i) && !renderingRef.current.has(i)) {
            renderPage(i, pageDiv)
          }
        }

        accumulatedHeight += pageHeight
      }
    }
  }, [renderPage]) // Removed pdf/totalPages - using refs

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Initial render of first few pages
  useEffect(() => {
    if (!pdf || totalPages === 0) return

    // Render first 3 pages
    for (let i = 1; i <= Math.min(3, totalPages); i++) {
      const pageDiv = pageRefs.current.get(i)
      if (pageDiv && !renderedPagesRef.current.has(i)) {
        renderPage(i, pageDiv)
      }
    }
  }, [pdf, totalPages, renderPage])

  // Update content detection when investigate mode changes
  useEffect(() => {
    if (isInvestigateMode) {
      // Detect content in all rendered pages
      for (const pageNum of renderedPagesRef.current) {
        const textContent = textContentCache.current.get(pageNum)
        const textLayer = textLayerRefs.current.get(pageNum)
        if (textContent && textLayer) {
          detectPageContent(pageNum, textContent)
          requestAnimationFrame(() => {
            updateZoneBounds(pageNum, textLayer)
          })
        }
      }
    } else {
      // Clear detection when exiting investigate mode
      clearContentDetection()
    }
  }, [isInvestigateMode, detectPageContent, updateZoneBounds, clearContentDetection])

  // Restore initial scroll position after first page renders
  useEffect(() => {
    if (!containerRef.current || !pdf || initialScrollApplied.current) return
    if (initialScrollPosition && initialScrollPosition > 0 && renderedPages.size > 0) {
      containerRef.current.scrollTop = initialScrollPosition
      initialScrollApplied.current = true
    }
  }, [pdf, initialScrollPosition, renderedPages.size])

  // Report scroll position changes (debounced)
  useEffect(() => {
    if (!containerRef.current || !onScrollChange) return

    const container = containerRef.current
    const handleScrollReport = () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }
      scrollDebounceRef.current = setTimeout(() => {
        onScrollChange(container.scrollTop)
      }, 200)
    }

    container.addEventListener('scroll', handleScrollReport)
    return () => {
      container.removeEventListener('scroll', handleScrollReport)
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }
    }
  }, [onScrollChange])

  // Report scale changes
  useEffect(() => {
    onScaleChange?.(scale)
  }, [scale, onScaleChange])

  // Report current page changes and update input
  useEffect(() => {
    onPageChange?.(currentPage)
    setPageInput(currentPage.toString())
  }, [currentPage, onPageChange])

  // Report total pages changes
  useEffect(() => {
    onTotalPagesChange?.(totalPages)
  }, [totalPages, onTotalPagesChange])

  // Re-render on scale change with CSS transform for smooth visual scaling
  useEffect(() => {
    if (!pdf) return

    const container = containerRef.current
    if (!container) return

    // Calculate the scale ratio between new and previous scale for scroll adjustment
    const scaleRatio = scale / prevScaleRef.current

    // Apply CSS transform for instant visual scaling during gesture
    const transformScale = scale / renderScaleRef.current
    for (const [, pageContainer] of pageRefs.current.entries()) {
      pageContainer.style.transform = `scale(${transformScale})`
      pageContainer.style.transformOrigin = 'top left'

      // Update parent dimensions to match transformed size (prevents layout jumps)
      const parentDiv = pageContainer.parentElement
      if (parentDiv) {
        const canvas = pageContainer.querySelector('canvas')
        if (canvas) {
          const baseWidth = parseFloat(canvas.style.width)
          const baseHeight = parseFloat(canvas.style.height)
          if (!isNaN(baseWidth) && !isNaN(baseHeight)) {
            parentDiv.style.width = `${baseWidth * transformScale}px`
            parentDiv.style.height = `${baseHeight * transformScale}px`
          }
        }
      }
    }

    // Adjust scroll position proportionally to maintain the same view
    container.scrollTop = container.scrollTop * scaleRatio

    // Update previous scale for next change
    prevScaleRef.current = scale

    // Clear any pending debounce
    if (scaleDebounceRef.current) {
      clearTimeout(scaleDebounceRef.current)
    }

    // Debounce the actual re-render
    scaleDebounceRef.current = setTimeout(() => {
      // Skip re-render if scale hasn't changed significantly
      if (Math.abs(scale - renderScaleRef.current) < 0.01) return

      cancelAllRenderTasks()

      // Clear canvas cache (invalidated by scale change)
      canvasCacheRef.current.clear()
      canvasCacheOrderRef.current = []

      // Clear PDF.js content and reset transforms
      for (const container of pageRefs.current.values()) {
        container.innerHTML = ''
        container.style.transform = ''
      }

      renderScaleRef.current = scale
      setRenderedPages(new Set())
      renderedPagesRef.current.clear()

      // Re-render visible pages
      setTimeout(handleScroll, 0)
    }, 150) // 150ms debounce

    return () => {
      if (scaleDebounceRef.current) {
        clearTimeout(scaleDebounceRef.current)
      }
    }
  }, [scale, pdf, cancelAllRenderTasks, handleScroll])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAllRenderTasks()
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy()
        loadingTaskRef.current = null
      }
      if (pdfRef.current) {
        pdfRef.current.destroy()
        pdfRef.current = null
      }
      pageRefs.current.clear()
    }
  }, [cancelAllRenderTasks])

  // Pinch-to-zoom on trackpad (macOS sends wheel events with ctrlKey=true)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const delta = -e.deltaY * 0.01
        setScale((prev) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, prev + delta)))
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Keyboard shortcuts for zoom: Cmd/Ctrl + Plus/Minus/Zero
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setScale((prev) => Math.min(SCALE_MAX, prev + SCALE_STEP))
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault()
        setScale((prev) => Math.max(SCALE_MIN, prev - SCALE_STEP))
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        setScale(SCALE_DEFAULT)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const zoomIn = () => setScale((s) => Math.min(s + SCALE_STEP, SCALE_MAX))
  const zoomOut = () => setScale((s) => Math.max(s - SCALE_STEP, SCALE_MIN))
  const resetZoom = () => setScale(SCALE_DEFAULT)

  const goToPage = (page: number) => {
    const maxPage = totalPages || 1
    const safePage = Math.max(1, Math.min(maxPage, page))
    const pageDiv = pageRefs.current.get(safePage)
    if (pageDiv && containerRef.current) {
      pageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const commitPageInput = () => {
    const parsed = parseInt(pageInput, 10)
    if (Number.isNaN(parsed)) {
      setPageInput(currentPage.toString())
      return
    }
    const clamped = Math.max(1, Math.min(totalPages || 1, parsed))
    setPageInput(clamped.toString())
    goToPage(clamped)
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
            title="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
            title="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => {
                const next = e.target.value.replace(/[^0-9]/g, '')
                setPageInput(next)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitPageInput()
                  e.currentTarget.blur()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setPageInput(currentPage.toString())
                  e.currentTarget.blur()
                }
              }}
              onBlur={commitPageInput}
              className="w-12 px-1.5 py-0.5 text-center bg-gray-700/50 border border-gray-600/50 rounded text-gray-200 focus:outline-none focus:border-blue-500/50"
              aria-label="Page number"
            />
            <span className="text-gray-500">/ {totalPages || 0}</span>
          </div>
          <button
            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF pages container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto bg-gray-800 p-4 relative ${isInvestigateMode ? 'investigate-mode' : ''}`}
      >
        <div ref={pdfContainerRef} className="flex flex-col items-center gap-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              data-page-number={pageNum}
              className="pdf-page relative bg-white shadow-lg"
              style={{
                minWidth: '200px',
                minHeight: '280px',
              }}
            >
              {/* Skeleton placeholder - React-managed, sibling to render target */}
              {!renderedPages.has(pageNum) && (
                <div className="absolute inset-0 bg-white p-8 pointer-events-none z-0">
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-5/6 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-4/5 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse" />
                  </div>
                </div>
              )}

              {/* PDF.js render target - React does NOT manage children */}
              <div
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el)
                  else pageRefs.current.delete(pageNum)
                }}
                className="absolute inset-0"
              />

              {/* Highlight layer - rendered on top of text layer */}
              {renderedPages.has(pageNum) && onUpdateHighlight && onDeleteHighlight && (
                <HighlightLayer
                  highlights={highlights}
                  textLayerInfo={textLayerRefs.current.get(pageNum) ? {
                    container: textLayerRefs.current.get(pageNum)!,
                    textContent: textContentCache.current.get(pageNum) || '',
                    scale,
                  } : null}
                  pageNumber={pageNum}
                  onUpdateHighlight={onUpdateHighlight}
                  onDeleteHighlight={onDeleteHighlight}
                />
              )}

              {/* Bookmark indicator */}
              {onToggleBookmark && renderedPages.has(pageNum) && (
                <div className="absolute top-2 right-2 z-10">
                  <BookmarkIndicator
                    isBookmarked={bookmarkedPages.has(pageNum)}
                    onClick={() => onToggleBookmark(pageNum)}
                    size="md"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Interactive zone overlay for investigate mode */}
        <InteractiveZoneOverlay
          zones={zones}
          containerRef={pdfContainerRef}
          onZoneClick={onZoneClick}
          isVisible={isInvestigateMode}
        />
      </div>
    </div>
  )
})

const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(function PDFViewer(props, ref) {
  return <PDFViewerInner {...props} ref={ref} />
})

export default PDFViewer

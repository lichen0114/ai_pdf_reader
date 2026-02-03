import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Set worker source using Vite's ?url import for reliable path resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

interface PDFViewerProps {
  data: ArrayBuffer
  initialScrollPosition?: number
  initialScale?: number
  onScrollChange?: (scrollTop: number) => void
  onScaleChange?: (scale: number) => void
  onError?: (message: string) => void
}

const SCALE_DEFAULT = 1.5
const SCALE_MIN = 0.5
const SCALE_MAX = 3.0
const SCALE_STEP = 0.25

function PDFViewer({ data, initialScrollPosition, initialScale, onScrollChange, onScaleChange, onError }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [scale, setScale] = useState(initialScale ?? SCALE_DEFAULT)
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialScrollApplied = useRef(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const renderingRef = useRef<Set<number>>(new Set())
  const renderedPagesRef = useRef<Set<number>>(new Set())
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null)
  const renderTasksRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map())
  const scaleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderScaleRef = useRef(SCALE_DEFAULT)
  const prevScaleRef = useRef(SCALE_DEFAULT)

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
      pageRefs.current.clear()
    }
  }, [data, cancelAllRenderTasks])

  // Render a single page
  const renderPage = useCallback(
    async (pageNum: number, container: HTMLDivElement) => {
      if (!pdf || renderingRef.current.has(pageNum)) return
      // Skip if already rendered (canvas exists)
      if (container.querySelector('canvas')) return

      renderingRef.current.add(pageNum)

      try {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale })

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
        textLayer.style.setProperty('--scale-factor', scale.toString())
        container.appendChild(textLayer)

        // Render text layer using new API
        const textLayerInstance = new TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport,
        })
        await textLayerInstance.render()

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
    [pdf, scale]
  )

  // Handle scroll to detect visible pages
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !pdf) return

    const container = containerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight

    // Find current page based on scroll position
    let accumulatedHeight = 0
    for (let i = 1; i <= totalPages; i++) {
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

    // Render visible pages
    const visibleStart = scrollTop - containerHeight
    const visibleEnd = scrollTop + containerHeight * 2

    accumulatedHeight = 0
    for (let i = 1; i <= totalPages; i++) {
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
  }, [pdf, totalPages, renderPage])

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
    const pageDiv = pageRefs.current.get(page)
    if (pageDiv && containerRef.current) {
      pageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
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
          <span className="text-sm text-gray-400">
            {currentPage} / {totalPages}
          </span>
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
        className="flex-1 overflow-auto bg-gray-800 p-4"
      >
        <div className="flex flex-col items-center gap-4">
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
              {/* Loading spinner - React-managed, sibling to render target */}
              {!renderedPages.has(pageNum) && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none z-0">
                  <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PDFViewer

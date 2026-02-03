import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Set worker source using Vite's ?url import for reliable path resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

interface PDFViewerProps {
  data: ArrayBuffer
  onError?: (message: string) => void
}

const SCALE_DEFAULT = 1.5
const SCALE_MIN = 0.5
const SCALE_MAX = 3.0
const SCALE_STEP = 0.25

function PDFViewer({ data, onError }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [scale, setScale] = useState(SCALE_DEFAULT)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const renderingRef = useRef<Set<number>>(new Set())

  // Load PDF document
  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      console.log('Loading PDF, data length:', data.byteLength)
      try {
        // Clone the ArrayBuffer to prevent detachment issues when PDF.js transfers it to the worker
        const dataClone = data.slice(0)
        const loadingTask = pdfjsLib.getDocument({ data: dataClone })
        const pdfDoc = await loadingTask.promise
        console.log('PDF loaded, pages:', pdfDoc.numPages)

        if (!cancelled) {
          setPdf(pdfDoc)
          setTotalPages(pdfDoc.numPages)
          setRenderedPages(new Set())
          renderingRef.current.clear()
          pageRefs.current.clear()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load PDF'
        console.error('Failed to load PDF:', err)
        onError?.(message)
      }
    }

    loadPdf()

    return () => {
      cancelled = true
    }
  }, [data])

  // Render a single page
  const renderPage = useCallback(
    async (pageNum: number, container: HTMLDivElement) => {
      if (!pdf || renderingRef.current.has(pageNum)) return

      renderingRef.current.add(pageNum)

      try {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale })

        // Clear container
        container.innerHTML = ''
        container.style.width = `${viewport.width}px`
        container.style.height = `${viewport.height}px`

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width * window.devicePixelRatio
        canvas.height = viewport.height * window.devicePixelRatio
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        container.appendChild(canvas)

        const context = canvas.getContext('2d')!
        context.scale(window.devicePixelRatio, window.devicePixelRatio)

        // Render page
        await page.render({
          canvasContext: context,
          viewport,
        }).promise

        // Create text layer
        const textContent = await page.getTextContent()
        const textLayer = document.createElement('div')
        textLayer.className = 'textLayer'
        textLayer.style.width = `${viewport.width}px`
        textLayer.style.height = `${viewport.height}px`
        container.appendChild(textLayer)

        // Render text layer using new API
        const textLayerInstance = new TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport,
        })
        await textLayerInstance.render()

        setRenderedPages((prev) => new Set([...prev, pageNum]))
      } catch (err) {
        console.error(`Failed to render page ${pageNum}:`, err)
      } finally {
        renderingRef.current.delete(pageNum)
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
          if (!renderedPages.has(i) && !renderingRef.current.has(i)) {
            renderPage(i, pageDiv)
          }
        }

        accumulatedHeight += pageHeight
      }
    }
  }, [pdf, totalPages, renderedPages, renderPage])

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
      if (pageDiv && !renderedPages.has(i)) {
        renderPage(i, pageDiv)
      }
    }
  }, [pdf, totalPages, renderPage])

  // Re-render on scale change
  useEffect(() => {
    if (!pdf) return

    setRenderedPages(new Set())
    renderingRef.current.clear()

    // Re-render visible pages
    setTimeout(handleScroll, 0)
  }, [scale])

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
              ref={(el) => {
                if (el) pageRefs.current.set(pageNum, el)
              }}
              data-page-number={pageNum}
              className="pdf-page relative bg-white shadow-lg"
              style={{
                minWidth: '200px',
                minHeight: '280px',
              }}
            >
              {!renderedPages.has(pageNum) && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PDFViewer

import { useState, useCallback, useMemo } from 'react'
import type { ContentDetectionResult, InteractiveZone, InteractiveZoneType } from '../types/modes'
import { detectContent } from '../services/contentDetector'

interface UseContentDetectionOptions {
  /** Whether detection is currently enabled */
  enabled?: boolean
}

/**
 * Hook for detecting and tracking interactive content zones in PDF pages.
 * Used in investigate mode to highlight equations, code, and technical terms.
 */
export function useContentDetection(options: UseContentDetectionOptions = {}) {
  const { enabled = false } = options

  // Store detected content per page
  const [detectedContent, setDetectedContent] = useState<Map<number, ContentDetectionResult>>(new Map())

  // Store interactive zones with bounding rects
  const [zones, setZones] = useState<InteractiveZone[]>([])

  /**
   * Detect content in a page's text
   */
  const detectPageContent = useCallback((pageNum: number, text: string) => {
    if (!enabled) return

    const result = detectContent(text)
    setDetectedContent(prev => {
      const next = new Map(prev)
      next.set(pageNum, result)
      return next
    })
  }, [enabled])

  /**
   * Clear detection results for a page
   */
  const clearPageContent = useCallback((pageNum: number) => {
    setDetectedContent(prev => {
      const next = new Map(prev)
      next.delete(pageNum)
      return next
    })
    setZones(prev => prev.filter(z => !z.id.startsWith(`page-${pageNum}-`)))
  }, [])

  /**
   * Update zone bounding rects based on DOM elements
   * Called after text layer renders to position overlays correctly
   */
  const updateZoneBounds = useCallback((pageNum: number, textLayerElement: HTMLElement) => {
    if (!enabled) return

    const pageContent = detectedContent.get(pageNum)
    if (!pageContent) return

    const newZones: InteractiveZone[] = []

    // Helper to find spans containing the content
    const findSpansForRange = (startIndex: number, endIndex: number): DOMRect[] => {
      const spans = textLayerElement.querySelectorAll('span')
      const rects: DOMRect[] = []
      let currentIndex = 0

      for (const span of spans) {
        const spanText = span.textContent || ''
        const spanStart = currentIndex
        const spanEnd = currentIndex + spanText.length

        // Check if this span overlaps with our range
        if (spanEnd > startIndex && spanStart < endIndex) {
          rects.push(span.getBoundingClientRect())
        }

        currentIndex = spanEnd
        if (currentIndex >= endIndex) break
      }

      return rects
    }

    // Merge overlapping rects into bounding rect
    const mergeToBoundingRect = (rects: DOMRect[]): DOMRect | null => {
      if (rects.length === 0) return null

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

      for (const rect of rects) {
        minX = Math.min(minX, rect.left)
        minY = Math.min(minY, rect.top)
        maxX = Math.max(maxX, rect.right)
        maxY = Math.max(maxY, rect.bottom)
      }

      return new DOMRect(minX, minY, maxX - minX, maxY - minY)
    }

    // Create zones for equations
    for (const eq of pageContent.equations) {
      const rects = findSpansForRange(eq.startIndex, eq.endIndex)
      const boundingRect = mergeToBoundingRect(rects)
      if (boundingRect) {
        newZones.push({
          id: `page-${pageNum}-eq-${eq.id}`,
          type: 'equation',
          boundingRect,
          content: eq.latex,
          metadata: { latex: eq.latex },
        })
      }
    }

    // Create zones for code blocks
    for (const code of pageContent.codeBlocks) {
      const rects = findSpansForRange(code.startIndex, code.endIndex)
      const boundingRect = mergeToBoundingRect(rects)
      if (boundingRect) {
        newZones.push({
          id: `page-${pageNum}-code-${code.id}`,
          type: 'code',
          boundingRect,
          content: code.code,
          metadata: { language: code.language || undefined },
        })
      }
    }

    // Create zones for technical terms
    for (const term of pageContent.technicalTerms) {
      const rects = findSpansForRange(term.startIndex, term.endIndex)
      const boundingRect = mergeToBoundingRect(rects)
      if (boundingRect) {
        newZones.push({
          id: `page-${pageNum}-term-${term.id}`,
          type: 'term',
          boundingRect,
          content: term.term,
          metadata: { confidence: term.confidence },
        })
      }
    }

    // Update zones for this page
    setZones(prev => {
      const otherPages = prev.filter(z => !z.id.startsWith(`page-${pageNum}-`))
      return [...otherPages, ...newZones]
    })
  }, [enabled, detectedContent])

  /**
   * Get zones for a specific page
   */
  const getPageZones = useCallback((pageNum: number): InteractiveZone[] => {
    return zones.filter(z => z.id.startsWith(`page-${pageNum}-`))
  }, [zones])

  /**
   * Get zones by type
   */
  const getZonesByType = useCallback((type: InteractiveZoneType): InteractiveZone[] => {
    return zones.filter(z => z.type === type)
  }, [zones])

  /**
   * Summary stats
   */
  const stats = useMemo(() => {
    return {
      totalZones: zones.length,
      equations: zones.filter(z => z.type === 'equation').length,
      codeBlocks: zones.filter(z => z.type === 'code').length,
      technicalTerms: zones.filter(z => z.type === 'term').length,
    }
  }, [zones])

  /**
   * Clear all detection results
   */
  const clearAll = useCallback(() => {
    setDetectedContent(new Map())
    setZones([])
  }, [])

  return {
    // State
    detectedContent,
    zones,
    stats,

    // Actions
    detectPageContent,
    clearPageContent,
    updateZoneBounds,
    getPageZones,
    getZonesByType,
    clearAll,
  }
}

import { useState, useCallback, useMemo } from 'react'
import HighlightPopover from './HighlightPopover'
import { getHighlightBgClass } from './HighlightColorPicker'
import type { HighlightData } from '../../hooks/useHighlights'

interface TextLayerInfo {
  container: HTMLElement
  textContent: string
  scale: number
}

interface HighlightLayerProps {
  highlights: HighlightData[]
  textLayerInfo: TextLayerInfo | null
  pageNumber: number
  onUpdateHighlight: (id: string, updates: { color?: HighlightColor; note?: string }) => void
  onDeleteHighlight: (id: string) => void
}

interface HighlightRect {
  id: string
  highlight: HighlightData
  rects: DOMRect[]
}

function HighlightLayer({
  highlights,
  textLayerInfo,
  pageNumber,
  onUpdateHighlight,
  onDeleteHighlight,
}: HighlightLayerProps) {
  const [selectedHighlight, setSelectedHighlight] = useState<{
    highlight: HighlightData
    position: { x: number; y: number }
  } | null>(null)

  // Calculate highlight rectangles based on text layer
  const highlightRects = useMemo(() => {
    if (!textLayerInfo) return []

    const { container } = textLayerInfo
    const pageHighlights = highlights.filter(h => h.page_number === pageNumber)
    const result: HighlightRect[] = []

    for (const highlight of pageHighlights) {
      const rects = calculateHighlightRects(container, highlight.start_offset, highlight.end_offset)
      if (rects.length > 0) {
        result.push({ id: highlight.id, highlight, rects })
      }
    }

    return result
  }, [highlights, pageNumber, textLayerInfo])

  const handleHighlightClick = useCallback((e: React.MouseEvent, highlight: HighlightData) => {
    e.stopPropagation()
    setSelectedHighlight({
      highlight,
      position: { x: e.clientX, y: e.clientY },
    })
  }, [])

  const handleColorChange = useCallback((color: HighlightColor) => {
    if (selectedHighlight) {
      onUpdateHighlight(selectedHighlight.highlight.id, { color })
    }
  }, [selectedHighlight, onUpdateHighlight])

  const handleNoteChange = useCallback((note: string) => {
    if (selectedHighlight) {
      onUpdateHighlight(selectedHighlight.highlight.id, { note })
    }
  }, [selectedHighlight, onUpdateHighlight])

  const handleDelete = useCallback(() => {
    if (selectedHighlight) {
      onDeleteHighlight(selectedHighlight.highlight.id)
      setSelectedHighlight(null)
    }
  }, [selectedHighlight, onDeleteHighlight])

  if (!textLayerInfo) return null

  const containerRect = textLayerInfo.container.getBoundingClientRect()

  return (
    <>
      {/* Highlight rectangles */}
      {highlightRects.map(({ id, highlight, rects }) => (
        <div key={id}>
          {rects.map((rect, idx) => (
            <div
              key={`${id}-${idx}`}
              className={`absolute ${getHighlightBgClass(highlight.color)} cursor-pointer hover:brightness-110 transition-all ${highlight.note ? 'border-b-2 border-current' : ''}`}
              style={{
                left: rect.left - containerRect.left,
                top: rect.top - containerRect.top,
                width: rect.width,
                height: rect.height,
                pointerEvents: 'auto',
              }}
              onClick={(e) => handleHighlightClick(e, highlight)}
            />
          ))}
        </div>
      ))}

      {/* Popover for selected highlight */}
      {selectedHighlight && (
        <HighlightPopover
          highlight={selectedHighlight.highlight}
          position={selectedHighlight.position}
          onColorChange={handleColorChange}
          onNoteChange={handleNoteChange}
          onDelete={handleDelete}
          onClose={() => setSelectedHighlight(null)}
        />
      )}
    </>
  )
}

// Calculate rectangles for highlight based on character offsets
function calculateHighlightRects(
  textLayer: HTMLElement,
  startOffset: number,
  endOffset: number
): DOMRect[] {
  const rects: DOMRect[] = []
  const spans = textLayer.querySelectorAll('span')

  let currentOffset = 0

  for (const span of spans) {
    const text = span.textContent || ''
    const spanStart = currentOffset
    const spanEnd = currentOffset + text.length

    // Check if this span overlaps with the highlight
    const overlapStart = Math.max(spanStart, startOffset)
    const overlapEnd = Math.min(spanEnd, endOffset)

    if (overlapStart < overlapEnd) {
      // This span contains part of the highlight
      const range = document.createRange()

      // Find the text node
      const textNode = span.firstChild
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const localStart = overlapStart - spanStart
        const localEnd = overlapEnd - spanStart

        try {
          range.setStart(textNode, Math.max(0, localStart))
          range.setEnd(textNode, Math.min(text.length, localEnd))
          const rangeRects = range.getClientRects()
          for (let i = 0; i < rangeRects.length; i++) {
            rects.push(rangeRects[i])
          }
        } catch (e) {
          // Range setting failed, use entire span
          rects.push(span.getBoundingClientRect())
        }
      }
    }

    currentOffset += text.length
  }

  return rects
}

export default HighlightLayer

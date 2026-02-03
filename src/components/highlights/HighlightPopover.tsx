import { useState, useRef, useEffect } from 'react'
import HighlightColorPicker from './HighlightColorPicker'
import NoteEditor from './NoteEditor'
import type { HighlightData } from '../../hooks/useHighlights'

interface HighlightPopoverProps {
  highlight: HighlightData
  position: { x: number; y: number }
  onColorChange: (color: HighlightColor) => void
  onNoteChange: (note: string) => void
  onDelete: () => void
  onClose: () => void
}

function HighlightPopover({
  highlight,
  position,
  onColorChange,
  onNoteChange,
  onDelete,
  onClose,
}: HighlightPopoverProps) {
  const [isEditingNote, setIsEditingNote] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClick)
    }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditingNote) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isEditingNote])

  const handleSaveNote = (note: string) => {
    onNoteChange(note)
    setIsEditingNote(false)
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-gray-800 rounded-lg shadow-2xl border border-gray-700/50 p-3 min-w-[280px] max-w-[350px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 360),
        top: Math.min(position.y + 10, window.innerHeight - 300),
      }}
    >
      {/* Color picker row */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700/50">
        <HighlightColorPicker
          selectedColor={highlight.color as HighlightColor}
          onColorSelect={onColorChange}
        />
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-600/30 text-gray-400 hover:text-red-400 transition-colors"
          title="Delete highlight"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Highlighted text preview */}
      <div className="mb-3 p-2 bg-gray-700/30 rounded text-sm text-gray-300 max-h-[100px] overflow-y-auto">
        "{highlight.selected_text.length > 150
          ? highlight.selected_text.slice(0, 150) + '...'
          : highlight.selected_text}"
      </div>

      {/* Note section */}
      {isEditingNote ? (
        <NoteEditor
          initialNote={highlight.note}
          onSave={handleSaveNote}
          onCancel={() => setIsEditingNote(false)}
        />
      ) : (
        <div>
          {highlight.note ? (
            <div
              className="p-2 bg-gray-700/30 rounded text-sm text-gray-300 cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => setIsEditingNote(true)}
            >
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="flex-1">{highlight.note}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingNote(true)}
              className="w-full flex items-center gap-2 p-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/30 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add note
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default HighlightPopover

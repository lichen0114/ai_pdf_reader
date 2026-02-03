import { useMemo, useState } from 'react'
import type { ActionType } from '../hooks/useHistory'
import {
  containsLatex,
  containsCode,
  containsTechnicalTerm,
  getSelectionContentType,
  type SelectionContentType,
} from '../services/contentDetector'
import HighlightColorPicker from './highlights/HighlightColorPicker'

interface SelectionToolbarProps {
  selectionRect: DOMRect | null
  selectedText?: string
  onAction: (action: ActionType) => void
  onEquationClick?: (latex: string) => void
  onCodeClick?: (code: string) => void
  onExplainerClick?: (term: string) => void
  onHighlight?: (color: HighlightColor) => void
  isVisible: boolean
}

interface ToolbarButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  className?: string
}

function ToolbarButton({ icon, label, onClick, className = '' }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700/60 rounded-full transition-colors ${className}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// Divider between action groups
function Divider() {
  return <div className="w-px h-5 bg-gray-600/50 mx-1" />
}

export default function SelectionPopover({
  selectionRect,
  selectedText = '',
  onAction,
  onEquationClick,
  onCodeClick,
  onExplainerClick,
  onHighlight,
  isVisible,
}: SelectionToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow')

  // Detect content type
  const contentType = useMemo<SelectionContentType>(() => {
    if (!selectedText) return 'general'
    return getSelectionContentType(selectedText)
  }, [selectedText])

  const hasEquation = contentType === 'equation' || containsLatex(selectedText)
  const hasCode = contentType === 'code' || containsCode(selectedText)
  const hasTechnicalTerm = contentType === 'term' || containsTechnicalTerm(selectedText)

  // Show STEM actions if we have handlers and detected content
  const showEquationAction = hasEquation && onEquationClick
  const showCodeAction = hasCode && onCodeClick
  const showExplainerAction = hasTechnicalTerm && onExplainerClick

  const hasStemActions = showEquationAction || showCodeAction || showExplainerAction

  if (!isVisible || !selectionRect) return null

  const handleHighlightClick = () => {
    if (showColorPicker) {
      // Second click - apply highlight with selected color
      onHighlight?.(selectedColor)
      setShowColorPicker(false)
    } else {
      // First click - show color picker
      setShowColorPicker(true)
    }
  }

  const handleColorSelect = (color: HighlightColor) => {
    setSelectedColor(color)
    onHighlight?.(color)
    setShowColorPicker(false)
  }

  // Calculate toolbar width based on content
  const baseWidth = 280
  const stemWidth = hasStemActions ? 120 : 0
  const highlightWidth = onHighlight ? (showColorPicker ? 140 : 45) : 0
  const toolbarWidth = baseWidth + stemWidth + highlightWidth
  const toolbarHeight = 40
  const padding = 8
  const gap = 8

  let left = selectionRect.left + (selectionRect.width / 2) - (toolbarWidth / 2)
  let top = selectionRect.top - toolbarHeight - gap

  // Clamp to viewport bounds
  left = Math.max(padding, Math.min(left, window.innerWidth - toolbarWidth - padding))

  // Fallback to below if not enough space above
  if (top < padding) {
    top = selectionRect.bottom + gap
  }

  // Ensure it doesn't go off screen bottom
  top = Math.min(top, window.innerHeight - toolbarHeight - padding)

  return (
    <div
      className="selection-toolbar fixed z-50 flex items-center gap-1 px-2 py-1.5 bg-gray-800/90 backdrop-blur-sm rounded-full shadow-lg border border-gray-700/50"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      {/* Highlight action */}
      {onHighlight && (
        <>
          {showColorPicker ? (
            <div className="flex items-center px-2">
              <HighlightColorPicker
                selectedColor={selectedColor}
                onColorSelect={handleColorSelect}
                compact
              />
            </div>
          ) : (
            <button
              onClick={handleHighlightClick}
              className="p-2 text-gray-200 hover:bg-gray-700/60 rounded-full transition-colors"
              title="Highlight"
            >
              <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.5 14.5l-2.3-2.3 7.5-7.5 2.3 2.3-7.5 7.5zm-11-2l9-9 2.3 2.3-9 9H4.5v-2.3z" />
              </svg>
            </button>
          )}
          <Divider />
        </>
      )}

      {/* Standard actions */}
      <ToolbarButton
        icon={
          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        }
        label="Explain"
        onClick={() => onAction('explain')}
      />
      <ToolbarButton
        icon={
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        label="Summarize"
        onClick={() => onAction('summarize')}
      />
      <ToolbarButton
        icon={
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
        label="Define"
        onClick={() => onAction('define')}
      />

      {/* STEM actions - context-sensitive */}
      {hasStemActions && (
        <>
          <Divider />

          {/* Equation explorer */}
          {showEquationAction && (
            <ToolbarButton
              icon={
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
              label="Variables"
              onClick={() => onEquationClick(selectedText)}
              className="stem-action-btn equation"
            />
          )}

          {/* Code sandbox */}
          {showCodeAction && (
            <ToolbarButton
              icon={
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              label="Run"
              onClick={() => onCodeClick(selectedText)}
              className="stem-action-btn code"
            />
          )}

          {/* First principles explainer */}
          {showExplainerAction && (
            <ToolbarButton
              icon={
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              label="Deep Dive"
              onClick={() => onExplainerClick(selectedText)}
              className="stem-action-btn explainer"
            />
          )}
        </>
      )}
    </div>
  )
}

interface SelectionPopoverProps {
  selectionRect: DOMRect | null
  onAskAI: () => void
  isVisible: boolean
}

export default function SelectionPopover({ selectionRect, onAskAI, isVisible }: SelectionPopoverProps) {
  if (!isVisible || !selectionRect) return null

  // Calculate position below the selection, clamped to viewport
  const buttonWidth = 100
  const buttonHeight = 36
  const padding = 8
  const gap = 8

  let left = selectionRect.left + (selectionRect.width / 2) - (buttonWidth / 2)
  let top = selectionRect.bottom + gap

  // Clamp to viewport bounds
  left = Math.max(padding, Math.min(left, window.innerWidth - buttonWidth - padding))
  top = Math.min(top, window.innerHeight - buttonHeight - padding)

  // If not enough space below, show above
  if (top + buttonHeight > window.innerHeight - padding) {
    top = selectionRect.top - buttonHeight - gap
  }

  return (
    <button
      onClick={onAskAI}
      className="selection-popover fixed z-50 flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      Ask AI
    </button>
  )
}

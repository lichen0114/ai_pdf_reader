import { useState, useRef, useEffect } from 'react'

interface NoteEditorProps {
  initialNote: string | null
  onSave: (note: string) => void
  onCancel: () => void
  autoFocus?: boolean
}

function NoteEditor({ initialNote, onSave, onCancel, autoFocus = true }: NoteEditorProps) {
  const [note, setNote] = useState(initialNote || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.selectionStart = textareaRef.current.value.length
    }
  }, [autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSave(note)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a note..."
        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none"
        rows={3}
      />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Cmd+Enter to save, Escape to cancel</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-2 py-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(note)}
            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default NoteEditor

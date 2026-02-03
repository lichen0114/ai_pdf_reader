import { useCallback, useRef, useEffect } from 'react'
import type { CodeRuntime } from '../../types/code'

interface CodeEditorProps {
  code: string
  runtime: CodeRuntime
  onChange: (code: string) => void
  onRun?: () => void
  disabled?: boolean
}

export default function CodeEditor({
  code,
  runtime,
  onChange,
  onRun,
  disabled = false,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to run
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onRun?.()
      return
    }

    // Tab to indent
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // Insert tab (or spaces for Python)
      const indent = runtime === 'python' ? '    ' : '  '
      const newCode = code.slice(0, start) + indent + code.slice(end)
      onChange(newCode)

      // Move cursor after indent
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + indent.length
      })
    }
  }, [code, onChange, onRun, runtime])

  // Sync height with content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.max(200, textarea.scrollHeight)}px`
    }
  }, [code])

  return (
    <div className="relative h-full bg-gray-950 rounded-lg overflow-hidden">
      {/* Line numbers gutter */}
      <div className="absolute left-0 top-0 bottom-0 w-10 bg-gray-900 border-r border-gray-800 flex flex-col pt-3 text-right">
        {code.split('\n').map((_, i) => (
          <div
            key={i}
            className="px-2 text-xs text-gray-600 font-mono h-[1.5rem] leading-[1.5rem]"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code editor */}
      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-full h-full pl-12 pr-4 py-3
          bg-transparent text-gray-200 font-mono text-sm
          resize-none outline-none
          leading-[1.5rem]
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        spellCheck={false}
        placeholder={`Enter ${runtime === 'python' ? 'Python' : 'JavaScript'} code...`}
      />

      {/* Keyboard hint */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-600">
        {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to run
      </div>
    </div>
  )
}

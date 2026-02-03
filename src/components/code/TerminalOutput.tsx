import { useRef, useEffect } from 'react'
import type { OutputLine } from '../../types/code'

interface TerminalOutputProps {
  output: OutputLine[]
  isRunning: boolean
}

function OutputLineComponent({ line }: { line: OutputLine }) {
  const typeStyles: Record<OutputLine['type'], string> = {
    stdout: 'text-gray-200',
    stderr: 'text-red-400',
    system: 'text-gray-500 italic',
  }

  return (
    <div className={`font-mono text-sm whitespace-pre-wrap break-all ${typeStyles[line.type]}`}>
      {line.type === 'stderr' && (
        <span className="mr-2">{'>'}</span>
      )}
      {line.content}
    </div>
  )
}

export default function TerminalOutput({ output, isRunning }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [output])

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto bg-gray-950 p-3 font-mono"
    >
      {output.length === 0 ? (
        <div className="text-gray-500 text-sm">
          {isRunning ? 'Running...' : 'Output will appear here'}
        </div>
      ) : (
        <div className="space-y-1">
          {output.map(line => (
            <OutputLineComponent key={line.id} line={line} />
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Running...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

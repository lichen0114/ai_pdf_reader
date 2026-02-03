import RuntimeSelector from './RuntimeSelector'
import CodeEditor from './CodeEditor'
import TerminalOutput from './TerminalOutput'
import type { CodeRuntime, OutputLine } from '../../types/code'

interface CodeSandboxDrawerProps {
  isOpen: boolean
  code: string
  runtime: CodeRuntime
  output: OutputLine[]
  isRunning: boolean
  isRuntimeReady: boolean
  isLoadingRuntime: boolean
  error: string | null
  onClose: () => void
  onCodeChange: (code: string) => void
  onRuntimeChange: (runtime: CodeRuntime) => void
  onRun: () => void
  onStop: () => void
  onClear: () => void
  onReset: () => void
}

export default function CodeSandboxDrawer({
  isOpen,
  code,
  runtime,
  output,
  isRunning,
  isRuntimeReady,
  isLoadingRuntime,
  error,
  onClose,
  onCodeChange,
  onRuntimeChange,
  onRun,
  onStop,
  onClear,
  onReset,
}: CodeSandboxDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 animate-slide-in-bottom">
      {/* Drawer container */}
      <div className="h-[35vh] min-h-[280px] max-h-[50vh] bg-gray-900 border-t border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center gap-4">
            {/* Title */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-emerald-500/20">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white">Code Sandbox</span>
            </div>

            {/* Runtime selector */}
            <RuntimeSelector
              runtime={runtime}
              onRuntimeChange={onRuntimeChange}
              isLoading={isLoadingRuntime}
              disabled={isRunning}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Run/Stop button */}
            {isRunning ? (
              <button
                onClick={onStop}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                <span className="text-sm">Stop</span>
              </button>
            ) : (
              <button
                onClick={onRun}
                disabled={!isRuntimeReady || isLoadingRuntime}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg
                  ${isRuntimeReady && !isLoadingRuntime
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  }
                  transition-colors
                `}
              >
                {isLoadingRuntime ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
                <span className="text-sm">{isLoadingRuntime ? 'Loading...' : 'Run'}</span>
              </button>
            )}

            {/* Clear output */}
            <button
              onClick={onClear}
              className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              title="Clear output"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            {/* Reset code */}
            <button
              onClick={onReset}
              className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              title="Reset to original"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code editor */}
          <div className="flex-1 border-r border-gray-700/50 overflow-hidden">
            <CodeEditor
              code={code}
              runtime={runtime}
              onChange={onCodeChange}
              onRun={onRun}
              disabled={isRunning}
            />
          </div>

          {/* Terminal output */}
          <div className="flex-1 overflow-hidden">
            <TerminalOutput output={output} isRunning={isRunning} />
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div className="px-4 py-2 bg-red-900/30 border-t border-red-500/30 text-red-300 text-sm">
            <span className="font-medium">Error: </span>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

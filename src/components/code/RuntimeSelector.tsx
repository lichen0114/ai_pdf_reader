import type { CodeRuntime } from '../../types/code'

interface RuntimeSelectorProps {
  runtime: CodeRuntime
  onRuntimeChange: (runtime: CodeRuntime) => void
  isLoading: boolean
  disabled?: boolean
}

const RUNTIME_INFO: Record<CodeRuntime, { label: string; icon: string }> = {
  javascript: {
    label: 'JavaScript',
    icon: 'JS',
  },
  python: {
    label: 'Python',
    icon: 'Py',
  },
}

export default function RuntimeSelector({
  runtime,
  onRuntimeChange,
  isLoading,
  disabled = false,
}: RuntimeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-800 rounded-lg">
      {(Object.keys(RUNTIME_INFO) as CodeRuntime[]).map((rt) => {
        const info = RUNTIME_INFO[rt]
        const isActive = runtime === rt
        const isDisabledOrLoading = disabled || (isLoading && rt !== runtime)

        return (
          <button
            key={rt}
            onClick={() => !isDisabledOrLoading && onRuntimeChange(rt)}
            disabled={isDisabledOrLoading}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
              transition-all duration-150
              ${isActive
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }
              ${isDisabledOrLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span
              className={`
                w-6 h-6 flex items-center justify-center rounded text-xs font-bold
                ${rt === 'javascript'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-blue-500/20 text-blue-400'
                }
              `}
            >
              {info.icon}
            </span>
            <span>{info.label}</span>
            {isLoading && rt === runtime && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

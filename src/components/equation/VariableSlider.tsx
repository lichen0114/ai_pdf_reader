import { useCallback, useRef, useEffect } from 'react'
import type { EquationVariable } from '../../types/equation'

interface VariableSliderProps {
  variable: EquationVariable
  onChange: (name: string, value: number) => void
  isGraphVariable?: boolean
  onSetAsGraphVariable?: () => void
}

export default function VariableSlider({
  variable,
  onChange,
  isGraphVariable = false,
  onSetAsGraphVariable,
}: VariableSliderProps) {
  const { name, description, currentValue, range, step, unit, color } = variable
  const inputRef = useRef<HTMLInputElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastValueRef = useRef(currentValue)

  // Debounced onChange for smooth 60fps updates
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    lastValueRef.current = newValue

    // Use requestAnimationFrame for smooth updates
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = requestAnimationFrame(() => {
      onChange(name, lastValueRef.current)
    })
  }, [name, onChange])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  // Calculate percentage for gradient fill
  const percentage = ((currentValue - range[0]) / (range[1] - range[0])) * 100

  return (
    <div className="variable-slider mb-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Color indicator */}
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          {/* Variable name */}
          <span className="font-mono text-lg font-semibold text-white">
            {name}
          </span>
          {/* Description */}
          <span className="text-sm text-gray-400">
            {description}
          </span>
          {/* Graph indicator */}
          {isGraphVariable && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300">
              x-axis
            </span>
          )}
        </div>
        {/* Current value */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg text-white">
            {currentValue.toFixed(2)}
          </span>
          {unit && (
            <span className="text-sm text-gray-400">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Slider row */}
      <div className="flex items-center gap-3">
        {/* Graph toggle button */}
        {onSetAsGraphVariable && !isGraphVariable && (
          <button
            onClick={onSetAsGraphVariable}
            className="p-1.5 rounded hover:bg-gray-700/60 text-gray-500 hover:text-indigo-400 transition-colors"
            title="Use as graph x-axis"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        )}

        {/* Min value */}
        <span className="text-xs text-gray-500 w-12 text-right">
          {range[0]}
        </span>

        {/* Slider */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="range"
            min={range[0]}
            max={range[1]}
            step={step}
            value={currentValue}
            onChange={handleChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, #374151 ${percentage}%, #374151 100%)`,
            }}
          />
          {/* Custom thumb styling via CSS */}
        </div>

        {/* Max value */}
        <span className="text-xs text-gray-500 w-12">
          {range[1]}
        </span>
      </div>
    </div>
  )
}

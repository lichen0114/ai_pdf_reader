import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import VariableSlider from './VariableSlider'
import EquationGraph from './EquationGraph'
import type { ParsedEquation, GraphData } from '../../types/equation'

interface VariableManipulationModalProps {
  isOpen: boolean
  originalLatex: string
  parsedEquation: ParsedEquation | null
  isParsing: boolean
  error: string | null
  graphData: GraphData | null
  graphIndependentVar: string | null
  currentResult: number | null
  onClose: () => void
  onUpdateVariable: (name: string, value: number) => void
  onSetGraphVariable: (name: string) => void
}

export default function VariableManipulationModal({
  isOpen,
  originalLatex,
  parsedEquation,
  isParsing,
  error,
  graphData,
  graphIndependentVar,
  currentResult,
  onClose,
  onUpdateVariable,
  onSetGraphVariable,
}: VariableManipulationModalProps) {
  const katexRef = useRef<HTMLDivElement>(null)

  // Render LaTeX equation
  useEffect(() => {
    if (katexRef.current && originalLatex) {
      try {
        katex.render(originalLatex, katexRef.current, {
          displayMode: true,
          throwOnError: false,
          strict: false,
        })
      } catch (err) {
        console.error('KaTeX render error:', err)
        katexRef.current.textContent = originalLatex
      }
    }
  }, [originalLatex])

  if (!isOpen) return null

  // Get current value for the graph independent variable
  const currentGraphValue = parsedEquation?.variables.find(
    v => v.name === graphIndependentVar
  )?.currentValue

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Equation Explorer</h2>
              <p className="text-sm text-gray-400">Manipulate variables to see how they affect the result</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700/60 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Equation display */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <div
              ref={katexRef}
              className="text-xl text-center text-white overflow-x-auto"
            />
            {parsedEquation && currentResult !== null && (
              <div className="mt-3 text-center">
                <span className="text-sm text-gray-400">Current result: </span>
                <span className="text-lg font-mono text-indigo-400">
                  {currentResult.toFixed(4)}
                </span>
              </div>
            )}
          </div>

          {/* Loading state */}
          {isParsing && (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="ml-3 text-gray-400">Analyzing equation...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Error parsing equation</span>
              </div>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Variables and graph */}
          {parsedEquation && !isParsing && !error && (
            <div className="space-y-6">
              {/* Variable sliders */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-4">Variables</h3>
                {parsedEquation.variables.map(variable => (
                  <VariableSlider
                    key={variable.name}
                    variable={variable}
                    onChange={onUpdateVariable}
                    isGraphVariable={variable.name === graphIndependentVar}
                    onSetAsGraphVariable={() => onSetGraphVariable(variable.name)}
                  />
                ))}
              </div>

              {/* Graph */}
              {graphData && graphData.points.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-4">
                    Graph: {graphData.dependentVar} vs {graphData.independentVar}
                  </h3>
                  <div className="h-64 bg-gray-800/50 rounded-lg border border-gray-700/50 p-2 relative">
                    <EquationGraph
                      graphData={graphData}
                      currentVariableValue={currentGraphValue}
                      variables={parsedEquation.variables}
                    />
                  </div>
                </div>
              )}

              {/* Formula info */}
              <div className="text-sm text-gray-500 border-t border-gray-700/50 pt-4">
                <span className="font-medium">Formula:</span> {parsedEquation.formula}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

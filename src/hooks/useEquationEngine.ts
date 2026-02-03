import { useState, useCallback, useMemo } from 'react'
import type {
  EquationVariable,
  ParsedEquation,
  GraphData,
  GraphPoint,
  EquationParseResponse,
} from '../types/equation'

const COLORS = [
  '#818cf8', // indigo
  '#f472b6', // pink
  '#34d399', // emerald
  '#fbbf24', // amber
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#f87171', // red
  '#2dd4bf', // teal
]

interface UseEquationEngineOptions {
  onSimulationStart?: () => void
  onSimulationEnd?: () => void
}

export function useEquationEngine(options: UseEquationEngineOptions = {}) {
  const { onSimulationStart, onSimulationEnd } = options

  const [isOpen, setIsOpen] = useState(false)
  const [originalLatex, setOriginalLatex] = useState('')
  const [parsedEquation, setParsedEquation] = useState<ParsedEquation | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [graphIndependentVar, setGraphIndependentVar] = useState<string | null>(null)

  /**
   * Parse an equation using AI to extract variables
   */
  const parseEquation = useCallback(async (latex: string) => {
    setIsParsing(true)
    setError(null)

    try {
      // Use the AI to parse the equation
      let fullResponse = ''

      await window.api.askAI(
        latex,
        '',
        undefined,
        'parse_equation',
        undefined,
        (chunk) => {
          fullResponse += chunk
        },
        () => {
          // Parse the JSON response
          try {
            // Try to extract JSON from the response (handling possible markdown wrapping)
            let jsonStr = fullResponse.trim()
            if (jsonStr.startsWith('```json')) {
              jsonStr = jsonStr.slice(7)
            }
            if (jsonStr.startsWith('```')) {
              jsonStr = jsonStr.slice(3)
            }
            if (jsonStr.endsWith('```')) {
              jsonStr = jsonStr.slice(0, -3)
            }
            jsonStr = jsonStr.trim()

            const parsed: EquationParseResponse = JSON.parse(jsonStr)

            // Convert to our internal format with colors and current values
            const variables: EquationVariable[] = parsed.variables.map((v, i) => ({
              name: v.name,
              description: v.description,
              currentValue: (v.range[0] + v.range[1]) / 2, // Start at midpoint
              range: v.range,
              step: (v.range[1] - v.range[0]) / 100, // 100 steps
              unit: v.unit,
              color: COLORS[i % COLORS.length],
            }))

            setParsedEquation({
              latex,
              variables,
              formula: parsed.formula,
              computeExpression: parsed.compute,
            })

            // Default to first variable for graphing
            if (variables.length > 0) {
              setGraphIndependentVar(variables[0].name)
            }

            setIsParsing(false)
          } catch (parseError) {
            console.error('Failed to parse equation response:', parseError, fullResponse)
            setError('Failed to parse equation. The AI response was not in the expected format.')
            setIsParsing(false)
          }
        },
        (errorMsg) => {
          setError(errorMsg)
          setIsParsing(false)
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse equation'
      setError(message)
      setIsParsing(false)
    }
  }, [])

  /**
   * Open the equation engine with a LaTeX string
   */
  const openEquation = useCallback(async (latex: string) => {
    setOriginalLatex(latex)
    setIsOpen(true)
    setParsedEquation(null)
    setError(null)
    onSimulationStart?.()

    await parseEquation(latex)
  }, [parseEquation, onSimulationStart])

  /**
   * Close the equation engine
   */
  const closeEquation = useCallback(() => {
    setIsOpen(false)
    setOriginalLatex('')
    setParsedEquation(null)
    setError(null)
    setGraphIndependentVar(null)
    onSimulationEnd?.()
  }, [onSimulationEnd])

  /**
   * Update a variable's value
   */
  const updateVariable = useCallback((name: string, value: number) => {
    setParsedEquation(prev => {
      if (!prev) return prev
      return {
        ...prev,
        variables: prev.variables.map(v =>
          v.name === name ? { ...v, currentValue: value } : v
        ),
      }
    })
  }, [])

  /**
   * Compute the graph data by varying one variable
   */
  const graphData = useMemo<GraphData | null>(() => {
    if (!parsedEquation || !graphIndependentVar) return null

    const independentVar = parsedEquation.variables.find(v => v.name === graphIndependentVar)
    if (!independentVar) return null

    const points: GraphPoint[] = []
    const numPoints = 100

    // Build the compute function safely
    try {
      // Create variable values object
      const varValues: Record<string, number> = {}
      for (const v of parsedEquation.variables) {
        if (v.name !== graphIndependentVar) {
          varValues[v.name] = v.currentValue
        }
      }

      // Generate points
      const [min, max] = independentVar.range
      const step = (max - min) / numPoints

      for (let i = 0; i <= numPoints; i++) {
        const x = min + i * step
        varValues[graphIndependentVar] = x

        // Evaluate the compute expression with current values
        // Using Function constructor for safe evaluation
        const varNames = Object.keys(varValues)
        const varVals = Object.values(varValues)
        const fn = new Function(...varNames, `return ${parsedEquation.computeExpression}`)
        const y = fn(...varVals)

        if (typeof y === 'number' && isFinite(y)) {
          points.push({ x, y })
        }
      }

      // Determine the dependent variable name (left side of equation)
      const dependentVar = parsedEquation.formula.split('=')[0].trim()

      return {
        independentVar: graphIndependentVar,
        dependentVar,
        points,
      }
    } catch (err) {
      console.error('Failed to compute graph:', err)
      return null
    }
  }, [parsedEquation, graphIndependentVar])

  /**
   * Compute the current result with all variables
   */
  const currentResult = useMemo<number | null>(() => {
    if (!parsedEquation) return null

    try {
      const varValues: Record<string, number> = {}
      for (const v of parsedEquation.variables) {
        varValues[v.name] = v.currentValue
      }

      const varNames = Object.keys(varValues)
      const varVals = Object.values(varValues)
      const fn = new Function(...varNames, `return ${parsedEquation.computeExpression}`)
      const result = fn(...varVals)

      return typeof result === 'number' && isFinite(result) ? result : null
    } catch {
      return null
    }
  }, [parsedEquation])

  return {
    // State
    isOpen,
    originalLatex,
    parsedEquation,
    isParsing,
    error,
    graphData,
    graphIndependentVar,
    currentResult,

    // Actions
    openEquation,
    closeEquation,
    updateVariable,
    setGraphIndependentVar,
    parseEquation,
  }
}

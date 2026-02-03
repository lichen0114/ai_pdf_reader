// Equation Engine types for ActivePaper STEM Edition

export interface EquationVariable {
  name: string
  description: string
  currentValue: number
  range: [number, number]
  step: number
  unit?: string
  color: string
}

export interface ParsedEquation {
  latex: string
  variables: EquationVariable[]
  formula: string
  computeExpression: string
}

export interface GraphPoint {
  x: number
  y: number
}

export interface GraphData {
  independentVar: string
  dependentVar: string
  points: GraphPoint[]
}

export interface EquationEngineState {
  isOpen: boolean
  originalLatex: string
  parsedEquation: ParsedEquation | null
  graphData: GraphData | null
  isParsing: boolean
  error: string | null
}

// Colors for variable sliders
export const VARIABLE_COLORS = [
  '#818cf8', // indigo
  '#f472b6', // pink
  '#34d399', // emerald
  '#fbbf24', // amber
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#f87171', // red
  '#2dd4bf', // teal
]

// AI response format for equation parsing
export interface EquationParseResponse {
  variables: Array<{
    name: string
    description: string
    range: [number, number]
    unit?: string
  }>
  formula: string
  compute: string
}

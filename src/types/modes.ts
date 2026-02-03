// UI Mode types for ActivePaper STEM Edition

export type UIMode = 'reading' | 'investigate' | 'simulation'

export type SimulationType = 'equation' | 'code' | 'explainer' | null

export interface ModeState {
  mode: UIMode
  simulationType: SimulationType
  isAltPressed: boolean
}

export interface ModeContextValue extends ModeState {
  enterInvestigateMode: () => void
  exitInvestigateMode: () => void
  enterSimulation: (type: SimulationType) => void
  exitSimulation: () => void
  setAltPressed: (pressed: boolean) => void
}

// Content detection types
export interface DetectedEquation {
  id: string
  latex: string
  displayMode: boolean // true for $$ ... $$, false for $ ... $
  startIndex: number
  endIndex: number
  boundingRect?: DOMRect
}

export interface DetectedCodeBlock {
  id: string
  code: string
  language: string | null
  startIndex: number
  endIndex: number
  boundingRect?: DOMRect
}

export interface DetectedTechnicalTerm {
  id: string
  term: string
  startIndex: number
  endIndex: number
  confidence: number
  boundingRect?: DOMRect
}

export interface ContentDetectionResult {
  equations: DetectedEquation[]
  codeBlocks: DetectedCodeBlock[]
  technicalTerms: DetectedTechnicalTerm[]
}

// Zone types for overlay rendering
export type InteractiveZoneType = 'equation' | 'code' | 'term'

export interface InteractiveZone {
  id: string
  type: InteractiveZoneType
  boundingRect: DOMRect
  content: string
  metadata?: {
    language?: string
    latex?: string
    confidence?: number
  }
}

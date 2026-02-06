import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react'
import type { UIMode, SimulationType, ModeContextValue } from '../types/modes'

const ModeContext = createContext<ModeContextValue | null>(null)

interface ModeProviderProps {
  children: ReactNode
}

export function ModeProvider({ children }: ModeProviderProps) {
  const [mode, setMode] = useState<UIMode>('reading')
  const [simulationType, setSimulationType] = useState<SimulationType>(null)
  const [isAltPressed, setIsAltPressed] = useState(false)

  // Use refs to avoid dependency loop in event handlers
  const modeRef = useRef(mode)
  const isAltPressedRef = useRef(isAltPressed)

  // Keep refs in sync with state
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    isAltPressedRef.current = isAltPressed
  }, [isAltPressed])

  // Track Alt/Option key for investigate mode - empty deps array to avoid listener recreation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Option') {
        setIsAltPressed(true)
        // Only switch to investigate if not in simulation mode
        if (modeRef.current !== 'simulation') {
          setMode('investigate')
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Option') {
        setIsAltPressed(false)
        // Return to reading mode only if not in simulation
        if (modeRef.current === 'investigate') {
          setMode('reading')
        }
      }
    }

    // Handle blur (when window loses focus while Alt is held)
    const handleBlur = () => {
      if (isAltPressedRef.current) {
        setIsAltPressed(false)
        if (modeRef.current === 'investigate') {
          setMode('reading')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, []) // Empty deps - handlers use refs for current state

  const enterInvestigateMode = useCallback(() => {
    if (modeRef.current !== 'simulation') {
      setMode('investigate')
    }
  }, [])

  const exitInvestigateMode = useCallback(() => {
    if (modeRef.current === 'investigate') {
      setMode('reading')
    }
  }, [])

  const enterSimulation = useCallback((type: SimulationType) => {
    setMode('simulation')
    setSimulationType(type)
  }, [])

  const exitSimulation = useCallback(() => {
    setMode('reading')
    setSimulationType(null)
  }, [])

  const value = useMemo<ModeContextValue>(() => ({
    mode,
    simulationType,
    isAltPressed,
    enterInvestigateMode,
    exitInvestigateMode,
    enterSimulation,
    exitSimulation,
    setAltPressed: setIsAltPressed,
  }), [mode, simulationType, isAltPressed, enterInvestigateMode, exitInvestigateMode, enterSimulation, exitSimulation])

  return (
    <ModeContext.Provider value={value}>
      {children}
    </ModeContext.Provider>
  )
}

export function useModeContext(): ModeContextValue {
  const context = useContext(ModeContext)
  if (!context) {
    throw new Error('useModeContext must be used within a ModeProvider')
  }
  return context
}

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { UIMode, SimulationType, ModeContextValue } from '../types/modes'

const ModeContext = createContext<ModeContextValue | null>(null)

interface ModeProviderProps {
  children: ReactNode
}

export function ModeProvider({ children }: ModeProviderProps) {
  const [mode, setMode] = useState<UIMode>('reading')
  const [simulationType, setSimulationType] = useState<SimulationType>(null)
  const [isAltPressed, setIsAltPressed] = useState(false)

  // Track Alt/Option key for investigate mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Option') {
        setIsAltPressed(true)
        // Only switch to investigate if not in simulation mode
        if (mode !== 'simulation') {
          setMode('investigate')
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Option') {
        setIsAltPressed(false)
        // Return to reading mode only if not in simulation
        if (mode === 'investigate') {
          setMode('reading')
        }
      }
    }

    // Handle blur (when window loses focus while Alt is held)
    const handleBlur = () => {
      if (isAltPressed) {
        setIsAltPressed(false)
        if (mode === 'investigate') {
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
  }, [mode, isAltPressed])

  const enterInvestigateMode = useCallback(() => {
    if (mode !== 'simulation') {
      setMode('investigate')
    }
  }, [mode])

  const exitInvestigateMode = useCallback(() => {
    if (mode === 'investigate') {
      setMode('reading')
    }
  }, [mode])

  const enterSimulation = useCallback((type: SimulationType) => {
    setMode('simulation')
    setSimulationType(type)
  }, [])

  const exitSimulation = useCallback(() => {
    setMode('reading')
    setSimulationType(null)
  }, [])

  const value: ModeContextValue = {
    mode,
    simulationType,
    isAltPressed,
    enterInvestigateMode,
    exitInvestigateMode,
    enterSimulation,
    exitSimulation,
    setAltPressed: setIsAltPressed,
  }

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

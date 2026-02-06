import { useCallback, useMemo } from 'react'
import { useModeContext } from '../contexts/ModeContext'

/**
 * Hook for accessing and controlling the UI mode system.
 *
 * UI Modes:
 * - reading: Default mode, normal PDF viewing
 * - investigate: Alt/Option key held, interactive zones glow
 * - simulation: A tool is open (equation modal, code sandbox, or concept stack)
 */
export function useUIMode() {
  const {
    mode,
    simulationType,
    isAltPressed,
    enterInvestigateMode,
    exitInvestigateMode,
    enterSimulation,
    exitSimulation,
  } = useModeContext()

  // Convenience checks
  const isReading = mode === 'reading'
  const isInvestigating = mode === 'investigate'
  const isSimulating = mode === 'simulation'

  // Check specific simulation types
  const isEquationSimulation = isSimulating && simulationType === 'equation'
  const isCodeSimulation = isSimulating && simulationType === 'code'
  const isExplainerSimulation = isSimulating && simulationType === 'explainer'

  // Stable simulation openers (used by selection popover buttons)
  const openEquation = useCallback(() => enterSimulation('equation'), [enterSimulation])
  const openCodeSandbox = useCallback(() => enterSimulation('code'), [enterSimulation])
  const openExplainer = useCallback(() => enterSimulation('explainer'), [enterSimulation])

  return useMemo(() => ({
    // Current state
    mode,
    simulationType,
    isAltPressed,

    // Mode checks
    isReading,
    isInvestigating,
    isSimulating,
    isEquationSimulation,
    isCodeSimulation,
    isExplainerSimulation,

    // Actions
    enterInvestigateMode,
    exitInvestigateMode,
    enterSimulation,
    exitSimulation,
    openEquation,
    openCodeSandbox,
    openExplainer,
  }), [mode, simulationType, isAltPressed, isReading, isInvestigating, isSimulating,
       isEquationSimulation, isCodeSimulation, isExplainerSimulation,
       enterInvestigateMode, exitInvestigateMode, enterSimulation, exitSimulation,
       openEquation, openCodeSandbox, openExplainer])
}

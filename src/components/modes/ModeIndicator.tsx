import type { UIMode, SimulationType } from '../../types/modes'

interface ModeIndicatorProps {
  mode: UIMode
  simulationType: SimulationType
}

const MODE_CONFIG: Record<UIMode, { label: string; color: string; bgColor: string }> = {
  reading: {
    label: 'Reading',
    color: 'text-gray-400',
    bgColor: 'bg-gray-800/60',
  },
  investigate: {
    label: 'Investigate',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-900/40',
  },
  simulation: {
    label: 'Simulation',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-900/40',
  },
}

const SIMULATION_LABELS: Record<NonNullable<SimulationType>, string> = {
  equation: 'Equation Lab',
  code: 'Code Sandbox',
  explainer: 'Deep Dive',
}

export default function ModeIndicator({ mode, simulationType }: ModeIndicatorProps) {
  // Only show in non-reading modes
  if (mode === 'reading') return null

  const config = MODE_CONFIG[mode]
  const simulationLabel = simulationType ? SIMULATION_LABELS[simulationType] : null

  return (
    <div
      className={`
        fixed bottom-4 left-4 z-50
        flex items-center gap-2 px-3 py-1.5
        rounded-full border border-gray-700/50
        backdrop-blur-sm shadow-lg
        transition-all duration-300
        ${config.bgColor}
      `}
    >
      {/* Pulsing indicator dot */}
      <div className="relative">
        <div
          className={`w-2 h-2 rounded-full ${
            mode === 'investigate' ? 'bg-indigo-500' : 'bg-emerald-500'
          }`}
        />
        <div
          className={`absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75 ${
            mode === 'investigate' ? 'bg-indigo-500' : 'bg-emerald-500'
          }`}
        />
      </div>

      {/* Mode label */}
      <span className={`text-xs font-medium ${config.color}`}>
        {simulationLabel || config.label}
      </span>

      {/* Keyboard hint for investigate mode */}
      {mode === 'investigate' && (
        <span className="text-[10px] text-gray-500 ml-1">
          (Option held)
        </span>
      )}

      {/* Escape hint for simulation mode */}
      {mode === 'simulation' && (
        <span className="text-[10px] text-gray-500 ml-1">
          (Esc to close)
        </span>
      )}
    </div>
  )
}

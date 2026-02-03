interface STEMToolbarProps {
  hasEquation: boolean
  hasCode: boolean
  hasTechnicalTerm: boolean
  onEquationClick: () => void
  onCodeClick: () => void
  onExplainerClick: () => void
  disabled: boolean
}

interface ToolbarButtonProps {
  icon: React.ReactNode
  label: string
  tooltip: string
  onClick: () => void
  disabled: boolean
  colorClass: string
}

function ToolbarButton({ icon, label, tooltip, onClick, disabled, colorClass }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`stem-toolbar-btn flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
        disabled
          ? 'text-gray-500 cursor-not-allowed opacity-50'
          : `${colorClass} hover:scale-105`
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export default function STEMToolbar({
  hasEquation,
  hasCode,
  hasTechnicalTerm,
  onEquationClick,
  onCodeClick,
  onExplainerClick,
  disabled,
}: STEMToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-700/40 border border-gray-600/30">
      {/* Equation Explorer */}
      <ToolbarButton
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
        label="Equation"
        tooltip={disabled ? "Select text containing an equation" : hasEquation ? "Explore equation variables" : "No equation detected in selection"}
        onClick={onEquationClick}
        disabled={disabled || !hasEquation}
        colorClass="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20"
      />

      {/* Code Sandbox */}
      <ToolbarButton
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        label="Run Code"
        tooltip={disabled ? "Select a code block to run" : hasCode ? "Run code in sandbox" : "No code block detected in selection"}
        onClick={onCodeClick}
        disabled={disabled || !hasCode}
        colorClass="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
      />

      {/* Deep Dive / First Principles Explainer */}
      <ToolbarButton
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
        label="Deep Dive"
        tooltip={disabled ? "Select a technical term to explore" : hasTechnicalTerm ? "Explore concept from first principles" : "No technical term detected in selection"}
        onClick={onExplainerClick}
        disabled={disabled || !hasTechnicalTerm}
        colorClass="text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
      />
    </div>
  )
}

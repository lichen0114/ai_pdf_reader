import { useDashboard } from '../../hooks/useDashboard'
import ContextPrimingCards from './ContextPrimingCards'
import ConceptConstellation from './ConceptConstellation'
import StruggleHeatmap from './StruggleHeatmap'
import SpacedRepetitionDock from './SpacedRepetitionDock'

interface SynapseDashboardProps {
  onOpenDocument: (filepath: string) => void
}

export default function SynapseDashboard({ onOpenDocument }: SynapseDashboardProps) {
  const {
    recentDocuments,
    documentStats,
    activityByDay,
    conceptGraph,
    dueReviewCount,
    isLoading,
    refresh,
  } = useDashboard()

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  const hasData = recentDocuments.length > 0 || documentStats.length > 0 || conceptGraph.nodes.length > 0

  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 p-8">
        <div className="dashboard-empty max-w-md">
          <svg
            className="dashboard-empty-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h2 className="text-xl font-serif text-white mb-2">Your Learning Journey Begins</h2>
          <p className="text-gray-400 mb-6">
            Open a PDF and start asking questions. Your concepts, struggles, and insights will appear here.
          </p>
          <div className="text-sm text-gray-500">
            Tip: Select text and press <kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-300">Cmd+J</kbd> to explain
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-zinc-950 overflow-hidden">
      <div className="dashboard-grid h-full">
        {/* Left column: Context cards + Constellation */}
        <div className="dashboard-left">
          {/* Context Priming Cards - top 25% */}
          <div className="flex-none" style={{ height: '25%' }}>
            <ContextPrimingCards
              documents={recentDocuments}
              documentStats={documentStats}
              onOpenDocument={onOpenDocument}
            />
          </div>

          {/* Concept Constellation - bottom 75% */}
          <div className="flex-1 min-h-0">
            <ConceptConstellation
              graphData={conceptGraph}
              onOpenDocument={onOpenDocument}
            />
          </div>
        </div>

        {/* Right column: Heatmap + Review dock */}
        <div className="dashboard-right">
          {/* Struggle Heatmap - top portion */}
          <div className="flex-1 min-h-0 overflow-auto">
            <StruggleHeatmap
              documentStats={documentStats}
              activityByDay={activityByDay}
            />
          </div>

          {/* Spaced Repetition Dock - bottom fixed */}
          <div className="flex-none">
            <SpacedRepetitionDock
              dueCount={dueReviewCount}
              onReviewComplete={refresh}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

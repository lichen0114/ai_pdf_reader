interface BreadcrumbNavProps {
  breadcrumbs: string[]
  onNavigate: (index: number) => void
}

export default function BreadcrumbNav({ breadcrumbs, onNavigate }: BreadcrumbNavProps) {
  if (breadcrumbs.length === 0) return null

  return (
    <nav className="flex items-center gap-1 px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 overflow-x-auto">
      {/* Home/root icon */}
      <button
        onClick={() => onNavigate(0)}
        className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
        title="Back to first concept"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>

      {/* Breadcrumb items */}
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1
        const displayText = crumb.length > 20 ? crumb.slice(0, 20) + '...' : crumb

        return (
          <div key={index} className="flex items-center gap-1 flex-shrink-0">
            {/* Separator */}
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>

            {/* Crumb button */}
            <button
              onClick={() => !isLast && onNavigate(index)}
              className={`
                px-2 py-0.5 rounded text-sm
                ${isLast
                  ? 'text-amber-400 font-medium cursor-default'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors'
                }
              `}
              title={crumb}
            >
              {displayText}
            </button>
          </div>
        )
      })}

      {/* Depth indicator */}
      <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
        Depth: {breadcrumbs.length}
      </span>
    </nav>
  )
}

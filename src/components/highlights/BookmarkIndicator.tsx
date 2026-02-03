interface BookmarkIndicatorProps {
  isBookmarked: boolean
  onClick: () => void
  size?: 'sm' | 'md' | 'lg'
}

function BookmarkIndicator({ isBookmarked, onClick, size = 'md' }: BookmarkIndicatorProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`p-1 rounded transition-colors ${
        isBookmarked
          ? 'text-yellow-400 hover:text-yellow-300'
          : 'text-gray-400 hover:text-gray-200'
      }`}
      title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      <svg
        className={sizeClasses[size]}
        fill={isBookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  )
}

export default BookmarkIndicator

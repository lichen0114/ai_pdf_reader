const COLORS: { value: HighlightColor; bg: string; label: string }[] = [
  { value: 'yellow', bg: 'bg-yellow-400/60', label: 'Yellow' },
  { value: 'green', bg: 'bg-green-400/60', label: 'Green' },
  { value: 'blue', bg: 'bg-blue-400/60', label: 'Blue' },
  { value: 'pink', bg: 'bg-pink-400/60', label: 'Pink' },
  { value: 'purple', bg: 'bg-purple-400/60', label: 'Purple' },
]

interface HighlightColorPickerProps {
  selectedColor: HighlightColor
  onColorSelect: (color: HighlightColor) => void
  compact?: boolean
}

function HighlightColorPicker({ selectedColor, onColorSelect, compact = false }: HighlightColorPickerProps) {
  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
      {COLORS.map(({ value, bg, label }) => (
        <button
          key={value}
          onClick={() => onColorSelect(value)}
          className={`
            ${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full ${bg}
            border-2 transition-all
            ${selectedColor === value
              ? 'border-white scale-110'
              : 'border-transparent hover:scale-105 hover:border-white/50'}
          `}
          title={label}
        />
      ))}
    </div>
  )
}

export function getHighlightBgClass(color: string): string {
  switch (color) {
    case 'yellow': return 'bg-yellow-400/40'
    case 'green': return 'bg-green-400/40'
    case 'blue': return 'bg-blue-400/40'
    case 'pink': return 'bg-pink-400/40'
    case 'purple': return 'bg-purple-400/40'
    default: return 'bg-yellow-400/40'
  }
}

export default HighlightColorPicker

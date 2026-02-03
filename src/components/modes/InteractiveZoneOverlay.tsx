import { useMemo } from 'react'
import type { InteractiveZone, InteractiveZoneType } from '../../types/modes'

interface InteractiveZoneOverlayProps {
  zones: InteractiveZone[]
  containerRef: React.RefObject<HTMLElement>
  onZoneClick?: (zone: InteractiveZone) => void
  isVisible: boolean
}

const ZONE_COLORS: Record<InteractiveZoneType, { border: string; glow: string; bg: string }> = {
  equation: {
    border: 'rgba(129, 140, 248, 0.6)',  // indigo
    glow: 'rgba(129, 140, 248, 0.4)',
    bg: 'rgba(129, 140, 248, 0.1)',
  },
  code: {
    border: 'rgba(52, 211, 153, 0.6)',    // emerald
    glow: 'rgba(52, 211, 153, 0.4)',
    bg: 'rgba(52, 211, 153, 0.1)',
  },
  term: {
    border: 'rgba(251, 191, 36, 0.6)',    // amber
    glow: 'rgba(251, 191, 36, 0.4)',
    bg: 'rgba(251, 191, 36, 0.1)',
  },
}

function ZoneHighlight({
  zone,
  containerRect,
  onClick,
}: {
  zone: InteractiveZone
  containerRect: DOMRect | null
  onClick?: (zone: InteractiveZone) => void
}) {
  const colors = ZONE_COLORS[zone.type]

  // Calculate position relative to container
  const style = useMemo(() => {
    if (!containerRect) return { display: 'none' }

    const rect = zone.boundingRect
    return {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      boxShadow: `0 0 12px ${colors.glow}`,
    }
  }, [zone.boundingRect, containerRect, colors])

  return (
    <div
      className="interactive-zone absolute rounded cursor-pointer transition-all duration-200 hover:scale-105"
      style={style}
      onClick={() => onClick?.(zone)}
      title={`${zone.type}: ${zone.content.slice(0, 50)}${zone.content.length > 50 ? '...' : ''}`}
    >
      {/* Pulsing border effect */}
      <div
        className="absolute inset-0 rounded border-2 animate-pulse-glow"
        style={{ borderColor: colors.border }}
      />
    </div>
  )
}

export default function InteractiveZoneOverlay({
  zones,
  containerRef,
  onZoneClick,
  isVisible,
}: InteractiveZoneOverlayProps) {
  // Get container bounding rect for relative positioning
  const containerRect = useMemo(() => {
    return containerRef.current?.getBoundingClientRect() || null
  }, [containerRef.current, zones]) // Recalculate when zones change

  if (!isVisible || zones.length === 0) return null

  return (
    <div className="interactive-zones-overlay absolute inset-0 pointer-events-none z-10">
      {/* Zone highlights */}
      <div className="pointer-events-auto">
        {zones.map(zone => (
          <ZoneHighlight
            key={zone.id}
            zone={zone}
            containerRect={containerRect}
            onClick={onZoneClick}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-3 bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-700/50">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: ZONE_COLORS.equation.border }} />
          <span className="text-gray-400">Equations</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: ZONE_COLORS.code.border }} />
          <span className="text-gray-400">Code</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: ZONE_COLORS.term.border }} />
          <span className="text-gray-400">Terms</span>
        </div>
      </div>
    </div>
  )
}

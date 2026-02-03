import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { GraphData, EquationVariable } from '../../types/equation'

interface EquationGraphProps {
  graphData: GraphData
  currentVariableValue?: number
  variables: EquationVariable[]
}

export default function EquationGraph({
  graphData,
  currentVariableValue,
  variables,
}: EquationGraphProps) {
  const { independentVar, dependentVar, points } = graphData

  // Find the variable color for the line
  const variableColor = useMemo(() => {
    const variable = variables.find(v => v.name === independentVar)
    return variable?.color || '#818cf8'
  }, [variables, independentVar])

  // Compute Y value at current X
  const currentY = useMemo(() => {
    if (currentVariableValue === undefined || points.length === 0) return null

    // Find the closest point
    let closest = points[0]
    let minDist = Math.abs(points[0].x - currentVariableValue)

    for (const point of points) {
      const dist = Math.abs(point.x - currentVariableValue)
      if (dist < minDist) {
        minDist = dist
        closest = point
      }
    }

    return closest.y
  }, [points, currentVariableValue])

  // Format axis tick values
  const formatTick = (value: number) => {
    if (Math.abs(value) < 0.01 || Math.abs(value) >= 1000) {
      return value.toExponential(1)
    }
    return value.toFixed(value % 1 === 0 ? 0 : 1)
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { x: number; y: number } }> }) => {
    if (!active || !payload || !payload[0]) return null

    const { x, y } = payload[0].payload
    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded px-3 py-2 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gray-400">{independentVar}:</span>
          <span className="text-white font-mono">{x.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{dependentVar}:</span>
          <span className="text-white font-mono">{y.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="equation-graph w-full h-full min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="x"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={formatTick}
            label={{
              value: independentVar,
              position: 'bottom',
              offset: -5,
              fill: '#9CA3AF',
              fontSize: 12,
            }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={formatTick}
            label={{
              value: dependentVar,
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fill: '#9CA3AF',
              fontSize: 12,
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference lines for current position */}
          {currentVariableValue !== undefined && (
            <>
              <ReferenceLine
                x={currentVariableValue}
                stroke={variableColor}
                strokeDasharray="5 5"
                strokeWidth={2}
              />
              {currentY !== null && (
                <ReferenceLine
                  y={currentY}
                  stroke={variableColor}
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  strokeOpacity={0.5}
                />
              )}
            </>
          )}

          {/* Main line */}
          <Line
            type="monotone"
            dataKey="y"
            stroke={variableColor}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 6,
              fill: variableColor,
              stroke: '#1F2937',
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Current point indicator */}
      {currentVariableValue !== undefined && currentY !== null && (
        <div className="absolute bottom-14 right-8 bg-gray-900/90 border border-gray-700 rounded px-3 py-2">
          <div className="text-xs text-gray-400 mb-1">Current point</div>
          <div className="font-mono text-white">
            ({currentVariableValue.toFixed(2)}, {currentY.toFixed(2)})
          </div>
        </div>
      )}
    </div>
  )
}

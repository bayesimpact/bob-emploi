import React from 'react'

const getPointFromPercent = (percent: number, radius: number): {x: number; y: number} => {
  const rad = percent * Math.PI / 100
  const x = -radius * Math.cos(rad)
  const y = -radius * Math.sin(rad)
  return {x, y}
}

const describeSvgArc = (startPercent: number, endPercent: number, radius: number): string => {
  const start = getPointFromPercent(startPercent, radius)
  const end = getPointFromPercent(endPercent, radius)
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`
}

interface ColoredSegment {
  color: string
  max: number
  min: number
}

// TODO(cyrille): Use a colorblind-friendly palette.
const DEFAULT_SEGMENTS: readonly ColoredSegment[] = [
  {color: colors.GREENISH_TEAL, max: 30, min: 0},
  {color: colors.SQUASH, max: 60, min: 30},
  {color: colors.RED_PINK, max: 100, min: 60},
] as const

interface GaugeProps {
  needleColor?: string
  needleWidth?: number
  percent: number
  radius?: number
  segments?: readonly ColoredSegment[]
  strokeWidth?: number
}
const Gauge = ({
  needleColor = colors.DARK_TWO,
  percent,
  radius = 64,
  segments = DEFAULT_SEGMENTS,
  strokeWidth = radius / 2,
  needleWidth = strokeWidth / 2,
}: GaugeProps): React.ReactElement => {
  const largeRadius = radius + strokeWidth / 2
  const totalHeight = radius + (strokeWidth + needleWidth) / 2
  const totalWidth = 2 * radius + strokeWidth
  const needlePoint = getPointFromPercent(percent, radius)
  const needleBaseLeft = getPointFromPercent(percent - 50, needleWidth / 2)
  const needleBaseRight = getPointFromPercent(percent + 50, needleWidth / 2)
  return <svg
    fill="none"
    viewBox={`${-largeRadius} ${-largeRadius} ${totalWidth} ${totalHeight}`}>
    {segments.map(({color, max, min}) =>
      <path
        key={max}
        d={describeSvgArc(min, max, radius)}
        stroke={color}
        strokeWidth={strokeWidth} />)}
    <path fill={needleColor} d={`
      M ${needlePoint.x} ${needlePoint.y}
      L ${needleBaseLeft.x} ${needleBaseLeft.y}
      A ${needleWidth / 2} ${needleWidth / 2} 0 0 0 ${needleBaseRight.x} ${needleBaseRight.y}
    `} />
    <circle fill={needleColor} r={needleWidth / 2} />
  </svg>
}

export default React.memo(Gauge)

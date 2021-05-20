import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'
import VisibilitySensor from 'react-visibility-sensor'


interface Props {
  backgroundColor?: string
  color: string
  children?: React.ReactNode
  durationMillisec?: number
  percentage: number
  radius?: number
  strokeWidth?: number
  style?: Omit<React.CSSProperties, 'color'>
}


// TODO(cyrille): Use this in transparency page.
const PieChart = (props: Props): React.ReactElement => {
  const {backgroundColor, children, color, durationMillisec = 1000, percentage, radius = 60,
    strokeWidth = 15, style} = props
  const [hasStartedGrowing, setHasStartedGrowing] = useState(false)

  const startGrowing = useCallback((isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    setHasStartedGrowing(true)
  }, [])

  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    color,
    display: 'flex',
    fontSize: 28,
    fontWeight: 'bold',
    height: 2 * radius,
    justifyContent: 'center',
    position: 'relative',
    width: 2 * radius,
    ...style,
  }), [color, radius, style])
  const currentPercentage = hasStartedGrowing ? percentage : 0
  const innerRadius = radius - strokeWidth / 2
  const perimeter = innerRadius * 2 * Math.PI
  const strokeLength = perimeter * currentPercentage / 100
  return <span style={containerStyle}>
    <VisibilitySensor
      active={!hasStartedGrowing} intervalDelay={250}
      onChange={startGrowing}>
      <svg
        style={{left: 0, position: 'absolute', top: 0}}
        viewBox={`-${radius} -${radius} ${2 * radius} ${2 * radius}`}>
        <circle
          r={innerRadius} fill="none" stroke={backgroundColor} strokeWidth={strokeWidth} />
        <circle
          r={innerRadius} fill="none" stroke={color}
          strokeDashoffset={perimeter / 4}
          strokeDasharray={`${strokeLength},${perimeter - strokeLength}`} strokeLinecap="round"
          strokeWidth={strokeWidth} style={{transition: `${durationMillisec}ms`}} />
      </svg>
    </VisibilitySensor>
    {children}
  </span>
}
PieChart.propTypes = {
  backgroundColor: PropTypes.string,
  children: PropTypes.node,
  durationMillisec: PropTypes.number,
  percentage: PropTypes.number.isRequired,
  radius: PropTypes.number,
  strokeWidth: PropTypes.number,
  style: PropTypes.object,
}


export default React.memo(PieChart)


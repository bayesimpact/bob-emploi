import PropTypes from 'prop-types'
import React, {useEffect, useState} from 'react'


interface Props {
  periodMilliseconds?: number
  size?: number
  style?: React.CSSProperties
  thickness?: number
}


const CircularProgress = (props: Props): React.ReactElement => {
  const {periodMilliseconds = 1750, size = 80, style, thickness = 3.5} = props
  const [isWrapperRotated, setIsWrappedRotated] = useState(false)
  const [scalePath, setScalePath] = useState(0)

  useEffect((): (() => void) => {
    const timeout = window.setTimeout(
      (): void => setScalePath((scalePath + 1) % 3),
      scalePath ? .4 * periodMilliseconds : .2 * periodMilliseconds,
    )
    return (): void => window.clearTimeout(timeout)
  }, [periodMilliseconds, scalePath])

  useEffect((): (() => void) => {
    const timeout = window.setTimeout(
      (): void => setIsWrappedRotated(!isWrapperRotated),
      isWrapperRotated ? periodMilliseconds * 5.7143 : 50,
    )
    return (): void => window.clearTimeout(timeout)
  }, [isWrapperRotated, periodMilliseconds])

  const containerStyle: React.CSSProperties = {
    color: colors.BOB_BLUE,
    height: size,
    marginLeft: 'auto',
    marginRight: 'auto',
    position: 'relative',
    width: size,
    ...style,
  }
  const color = containerStyle.color
  const wrapperStyle: React.CSSProperties = {
    display: 'inline-block',
    height: size,
    transform: `rotate(${isWrapperRotated ? '1800' : '0'}deg)`,
    transition: `all ${isWrapperRotated ? '10' : '0'}s linear`,
    width: size,
  }
  const getArcLength = (fraction: number): number => fraction * Math.PI * (size - thickness)
  let strokeDasharray, strokeDashoffset, transitionDuration
  if (scalePath === 0) {
    strokeDasharray = `${getArcLength(0)}, ${getArcLength(1)}`
    strokeDashoffset = 0
    transitionDuration = '0'
  } else if (scalePath === 1) {
    strokeDasharray = `${getArcLength(0.7)}, ${getArcLength(1)}`
    strokeDashoffset = getArcLength(-0.3)
    transitionDuration = periodMilliseconds * .4
  } else {
    strokeDasharray = `${getArcLength(0.7)}, ${getArcLength(1)}`
    strokeDashoffset = getArcLength(-1)
    transitionDuration = periodMilliseconds * .4857
  }
  const pathStyle: React.CSSProperties = {
    stroke: color,
    strokeDasharray,
    strokeDashoffset,
    strokeLinecap: 'round',
    transition: `all ${transitionDuration}ms ease-in-out`,
  }

  return <div style={containerStyle}>
    <div style={wrapperStyle}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle
          style={pathStyle}
          cx={size / 2} cy={size / 2}
          r={(size - thickness) / 2}
          strokeWidth={thickness}
          strokeMiterlimit="20" fill="none" />
      </svg>
    </div>
  </div>
}
CircularProgress.propTypes = {
  periodMilliseconds: PropTypes.number,
  size: PropTypes.number,
  style: PropTypes.object,
  thickness: PropTypes.number,
}


export default React.memo(CircularProgress)

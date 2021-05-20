import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import VisibilitySensor from 'react-visibility-sensor'

import useMedia from 'hooks/media'


interface Props {
  durationMillisec?: number
  isSteady?: boolean
  number: number
  style?: React.CSSProperties
}


const GrowingNumber = (props: Props): React.ReactElement => {
  const isForPrint = useMedia() === 'print'
  const {durationMillisec = 1000, isSteady, number, style} = props
  const [growingForMillisec, setGrowingForMillisecs] = useState(0)
  const [hasGrown, setHasGrown] = useState(isForPrint)
  const [hasStartedGrowing, setHasStartedGrowing] = useState(false)
  const timeout = useRef<number|undefined>(undefined)
  useEffect((): void|(() => void) => {
    if (!hasStartedGrowing || hasGrown) {
      return
    }
    if (growingForMillisec >= durationMillisec) {
      setHasGrown(true)
      return
    }
    timeout.current = window.setTimeout(
      (): void => setGrowingForMillisecs(growingForMillisec + 50), 50)
    return (): void => window.clearTimeout(timeout.current)
  }, [durationMillisec, hasGrown, hasStartedGrowing, growingForMillisec])
  const startGrowing = useCallback((isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    setHasStartedGrowing(true)
  }, [])
  const maxNumDigits = number ? Math.floor(Math.log10(number)) + 1 : 1
  const containerStyle = useMemo((): React.CSSProperties|undefined => isSteady ? {
    display: 'inline-block',
    textAlign: 'right',
    // 0.625 was found empirically.
    width: `${maxNumDigits * 0.625}em`,
    ...style,
  } : style, [isSteady, maxNumDigits, style])
  return <span style={containerStyle}>
    <VisibilitySensor
      active={!hasStartedGrowing} intervalDelay={250} onChange={startGrowing}>
      <span>
        {hasGrown ? number : Math.round(growingForMillisec / durationMillisec * number)}
      </span>
    </VisibilitySensor>
  </span>
}
GrowingNumber.propTypes = {
  durationMillisec: PropTypes.number,
  isSteady: PropTypes.bool,
  number: PropTypes.number.isRequired,
  style: PropTypes.object,
}


export default React.memo(GrowingNumber)

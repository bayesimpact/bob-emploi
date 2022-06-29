import React, {useEffect, useMemo, useRef, useState} from 'react'

import useMedia from 'hooks/media'
import useOnScreen from 'hooks/on_screen'


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
  const domRef = useRef<HTMLSpanElement>(null)
  const hasStartedGrowing = useOnScreen(domRef, {isActive: !isForPrint, isForAppearing: true})
  useEffect((): void|(() => void) => {
    if (!hasStartedGrowing || hasGrown) {
      return
    }
    if (growingForMillisec >= durationMillisec) {
      setHasGrown(true)
      return
    }
    const timeout = window.setTimeout(
      (): void => setGrowingForMillisecs(growingForMillisec + 50), 50)
    return (): void => window.clearTimeout(timeout)
  }, [durationMillisec, hasGrown, hasStartedGrowing, growingForMillisec])
  const maxNumDigits = number ? Math.floor(Math.log10(number)) + 1 : 1
  const containerStyle = useMemo((): React.CSSProperties|undefined => isSteady ? {
    display: 'inline-block',
    textAlign: 'right',
    // 0.625 was found empirically.
    width: `${maxNumDigits * 0.625}em`,
    ...style,
  } : style, [isSteady, maxNumDigits, style])
  return <span style={containerStyle}>
    <span ref={domRef}>
      {hasGrown ? number : Math.round(growingForMillisec / durationMillisec * number)}
    </span>
  </span>
}


export default React.memo(GrowingNumber)

import React, {useCallback, useMemo, useRef} from 'react'
import {useTranslation} from 'react-i18next'

import useOnScreen from 'hooks/on_screen'

import {colorToAlpha} from 'components/colors'
import GrowingNumber from 'components/growing_number'

interface Props {
  color: string
  durationMillisec?: number
  halfAngleDeg?: number
  isAnimated?: boolean
  isCaptionShown?: boolean
  isPercentShown?: boolean
  percent: number
  radius?: number
  scoreSize?: number
  startColor?: string
  strokeWidth?: number
  style?: React.CSSProperties & {
    margin?: never
    marginBottom?: number
    marginLeft?: number
    marginRight?: number
    marginTop?: number
  }
}


const innerTextStyle: React.CSSProperties = {
  fontWeight: 'bold',
  left: 0,
  position: 'absolute',
  right: 0,
}
const bobScoreCaptionStyle: React.CSSProperties = {
  ...innerTextStyle,
  bottom: 0,
  color: colors.COOL_GREY,
  fontSize: 10,
  fontStyle: 'italic',
  margin: 'auto',
  maxWidth: 100,
  textAlign: 'center',
  textTransform: 'uppercase',
}


const BobScoreCircle = (props: Props): React.ReactElement => {
  const {
    color,
    durationMillisec = 1000,
    halfAngleDeg = 60,
    isAnimated = true,
    isCaptionShown = true,
    isPercentShown = true,
    percent,
    radius = 78.6,
    scoreSize = 31,
    startColor = colors.RED_PINK,
    strokeWidth = 4.3,
    style,
    ...extraProps
  } = props
  const {t} = useTranslation('components')
  const domRef = useRef<HTMLDivElement>(null)
  const hasStartedGrowing = useOnScreen(domRef, {isActive: isAnimated, isForAppearing: true})

  // Gives the point on the Bob score circle according to clockwise angle with origin at the bottom.
  const getPointFromAngle = useCallback((rad: number): {x: number; y: number} => {
    const x = -radius * Math.sin(rad)
    const y = radius * Math.cos(rad)
    return {x, y}
  }, [radius])

  const describeSvgArc = useCallback((startAngle: number, endAngle: number): string => {
    const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1'
    const start = getPointFromAngle(startAngle)
    const end = getPointFromAngle(endAngle)
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
  }, [getPointFromAngle, radius])

  const startAngle = halfAngleDeg * Math.PI / 180
  const endAngle = 2 * Math.PI - startAngle
  const percentAngle = 2 * (Math.PI - startAngle) * percent / 100 + startAngle

  const largeRadius = radius + 3 * strokeWidth
  const totalWidth = 2 * largeRadius
  const totalHeight = largeRadius + strokeWidth + getPointFromAngle(startAngle).y

  const arcLength = radius * (percentAngle - startAngle)
  const percentPath = describeSvgArc(startAngle, percentAngle)
  const fullPath = describeSvgArc(startAngle, endAngle)
  const containerStyle = useMemo((): React.CSSProperties => ({
    height: totalHeight,
    position: 'relative',
    width: totalWidth,
    ...style,
    marginBottom: (style?.marginBottom || 0) - strokeWidth,
    marginLeft: (style?.marginLeft || 0) + 20 - strokeWidth,
    marginRight: (style?.marginRight || 0) + 20 - strokeWidth,
    marginTop: (style?.marginTop || 0) - 3 * strokeWidth,
  }), [style, strokeWidth, totalHeight, totalWidth])
  const percentStyle = useMemo((): React.CSSProperties => ({
    ...innerTextStyle,
    display: 'flex',
    fontSize: scoreSize,
    justifyContent: 'center',
    lineHeight: '37px',
    marginRight: 'auto',
    top: largeRadius, // center in circle, not in svg
    transform: 'translate(0, -80%)',
  }), [largeRadius, scoreSize])
  const percentColor = !hasStartedGrowing ? startColor : color
  const transitionStyle: React.CSSProperties = {
    transition: `stroke ${durationMillisec}ms linear,
      stroke-dashoffset ${durationMillisec}ms linear`,
  }
  return <div ref={domRef} {...extraProps} style={containerStyle}>
    {isPercentShown ? <div style={percentStyle}>
      {isAnimated ?
        <GrowingNumber
          durationMillisec={durationMillisec} number={percent} isSteady={true} /> :
        percent
      }%</div> : null}
    {isCaptionShown ?
      <div style={bobScoreCaptionStyle}>{t("score d'employabilité")}</div> : null}
    <svg
      fill="none"
      viewBox={`${-largeRadius} ${-largeRadius} ${totalWidth} ${totalHeight}`}>
      <g strokeLinecap="round">
        <path
          d={fullPath} stroke={colorToAlpha(colors.SILVER, .3)} strokeWidth={2 * strokeWidth} />
        <path
          style={transitionStyle}
          d={percentPath}
          stroke={percentColor}
          strokeDasharray={`${arcLength}, ${2 * arcLength}`}
          strokeDashoffset={hasStartedGrowing ? 0 : arcLength}
          strokeWidth={2 * strokeWidth}
        />
        <path
          d={percentPath}
          style={transitionStyle}
          stroke={percentColor}
          strokeDasharray={`0, ${arcLength}`}
          strokeDashoffset={hasStartedGrowing ? -arcLength + 1 : 0}
          strokeWidth={6 * strokeWidth} />
        <path
          d={percentPath}
          stroke="#fff"
          style={transitionStyle}
          strokeDasharray={`0, ${arcLength}`}
          strokeDashoffset={hasStartedGrowing ? -arcLength + 1 : 0}
          strokeWidth={2 * strokeWidth} />
      </g>
    </svg>
  </div>
}


export default React.memo(BobScoreCircle)

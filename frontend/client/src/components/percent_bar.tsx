import React, {useMemo} from 'react'

import {SmoothTransitions} from 'components/theme'


interface Props extends React.HTMLProps<HTMLDivElement> {
  color: string
  height?: number
  isPercentShown?: boolean
  percent?: number
  style?: React.CSSProperties
}


const PercentBar = (props: Props): React.ReactElement => {
  const {color, height = 25, percent = 0, isPercentShown = true, style, ...otherProps} = props

  const containerStyle = useMemo((): React.CSSProperties => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ['WebkitPrintColorAdjust' as any]: 'exact',
    backgroundColor: colors.MODAL_PROJECT_GREY,
    borderRadius: 25,
    height: height,
    overflow: 'hidden',
    width: '100%',
    ...style,
  }), [height, style])
  const percentStyle = useMemo((): React.CSSProperties => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ['WebkitPrintColorAdjust' as any]: 'exact',
    backgroundColor: color,
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    height: '100%',
    lineHeight: height - 10 + 'px',
    paddingBottom: 3,
    paddingLeft: isPercentShown ? 18 : 0,
    paddingTop: 7,
    width: `${percent}%`,
    ...SmoothTransitions,
  }), [color, height, isPercentShown, percent])
  return <div style={containerStyle} {...otherProps}>
    {percent ? <div style={percentStyle}>
      {isPercentShown ? `${Math.round(percent)}%` : ''}
    </div> : null}
  </div>
}


export default React.memo(PercentBar)

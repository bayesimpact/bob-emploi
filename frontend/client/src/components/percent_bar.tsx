import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {SmoothTransitions} from 'components/theme'


interface Props {
  color: string
  height?: number
  isPercentShown?: boolean
  percent?: number
  style?: React.CSSProperties
}


const PercentBar = (props: Props): React.ReactElement => {
  const {color, height = 25, percent = 0, isPercentShown = true, style} = props

  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.MODAL_PROJECT_GREY,
    borderRadius: 25,
    height: height,
    overflow: 'hidden',
    width: '100%',
    ...style,
  }), [height, style])
  const percentStyle = useMemo((): React.CSSProperties => ({
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
  return <div style={containerStyle}>
    {percent ? <div style={percentStyle}>
      {isPercentShown ? `${Math.round(percent)}%` : ''}
    </div> : null}
  </div>
}
PercentBar.propTypes = {
  color: PropTypes.string.isRequired,
  height: PropTypes.number,
  isPercentShown: PropTypes.bool,
  percent: PropTypes.number,
  style: PropTypes.object,
}


export default React.memo(PercentBar)

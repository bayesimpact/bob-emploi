import React, {useMemo} from 'react'

import {colorToAlpha} from 'components/colors'


interface Props {
  height: string
  isHighlighted: boolean
  style?: React.CSSProperties
  subtitle?: string
  title: string
}


const titleStyle: React.CSSProperties = {
  left: 0,
  marginTop: 8,
  position: 'absolute',
  right: 0,
  textAlign: 'center',
  top: '100%',
}

const valueStyle: React.CSSProperties = {
  bottom: '100%',
  left: 0,
  position: 'absolute',
  right: 0,
  textAlign: 'center',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
}

const transparentBlue = colorToAlpha(colors.BOB_BLUE, .7)


const HistogramBar: React.FC<Props> = (props: Props): React.ReactElement => {
  const {height, isHighlighted, style, subtitle, title} = props
  // TODO(sil): Find a way to explain why a bar is highlighted.
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: isHighlighted ? colors.BOB_BLUE : transparentBlue,
    height,
    position: 'relative',
    ...style,
  }), [height, isHighlighted, style])
  return <div style={containerStyle}>
    <div style={titleStyle}>
      <div>{title}</div>
      {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
    </div>
    <div style={valueStyle}>{height}</div>
  </div>
}


export const barsContainerStyle = {
  alignItems: 'flex-end',
  borderBottom: `solid 1px ${colors.DARK_TWO}`,
  display: 'flex',
  height: 300,
  justifyContent: 'space-around',
  margin: '20px 0 68px',
  width: '100%',
} as const
export const barStyle = {flex: 1, margin: '0 15px'} as const


export default React.memo(HistogramBar)

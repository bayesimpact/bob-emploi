import React, {useMemo} from 'react'

interface Props {
  children: React.ReactNode
  style?: React.CSSProperties
}

const getTagStyle = (style?: React.CSSProperties): React.CSSProperties => {
  const padding = style?.fontStyle === 'italic' ? '6px 7px 6px 5px' : 6
  return {
    backgroundColor: colors.GREENISH_TEAL,
    borderRadius: 2,
    color: '#fff',
    display: 'inline-block',
    flexShrink: 0,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: .3,
    padding,
    textTransform: 'uppercase',
    ...style,
  }
}

const Tag = ({children, style}: Props): React.ReactElement => {
  const containerStyle = useMemo((): React.CSSProperties => getTagStyle(style), [style])
  return <span style={containerStyle}>
    {children}
  </span>
}


export default React.memo(Tag)

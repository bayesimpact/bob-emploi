import React, {useMemo} from 'react'


interface Props {
  // Desired width/height ratio for the frame.
  aspectRatio?: number
  children: React.ReactElement<{
    style: RadiumCSSProperties
  }>
  style?: React.CSSProperties
}


const coverallStyle: React.CSSProperties = {
  border: 'none',
  bottom: 0,
  height: '100%',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
  width: '100%',
} as const


// A nice way to have 16/9 video iframes.
const VideoFrame = (props: Props): React.ReactElement => {
  const {aspectRatio = 16 / 9, children, style} = props
  const childrenStyle = useMemo((): React.CSSProperties => ({
    ...children.props.style,
    ...coverallStyle,
  }), [children.props.style])
  const containerStyle = useMemo((): React.CSSProperties => ({
    height: 0, paddingBottom: `${100 / aspectRatio}%`, position: 'relative',
  }), [aspectRatio])
  return <div style={style}>
    <div style={containerStyle}>
      {React.cloneElement(children, {
        style: childrenStyle,
      })}
    </div>
  </div>
}


export default React.memo(VideoFrame)

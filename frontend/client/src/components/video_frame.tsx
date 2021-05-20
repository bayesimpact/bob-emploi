import PropTypes from 'prop-types'
import React, {useMemo} from 'react'


interface Props {
  aspectRatio?: number
  children: React.ReactElement<{
    height: string
    style: RadiumCSSProperties
    width: string
  }>
  style?: React.CSSProperties
}


const coverallStyle: React.CSSProperties = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
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
        height: '100%',
        style: childrenStyle,
        width: '100%',
      })}
    </div>
  </div>
}
VideoFrame.propTypes = {
  // Desired width/height ratio for the frame.
  aspectRatio: PropTypes.number,
  children: PropTypes.element.isRequired,
  style: PropTypes.object,
}


export default React.memo(VideoFrame)

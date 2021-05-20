import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import directHitImage from 'images/emojis/direct-hit.png'
import faceWithMedicalMask from 'images/emojis/face-with-medical-mask.png'
import graduationCapImage from 'images/emojis/graduation-cap.png'
import lightBulbImage from 'images/emojis/light-bulb.png'
import magnifyingGlassTiltedLeftImage from 'images/emojis/magnifying-glass-tilted-left.png'
import redHeartImage from 'images/emojis/red-heart.png'
import rocketImage from 'images/emojis/rocket.png'
import thumbsUpImage from 'images/emojis/thumbs-up.png'
import verticalTrafficLightImage from 'images/emojis/vertical-traffic-light.png'


// Source: https://emojipedia.org/ (use latest Apple version).
const EmojisDict = {
  '❤': redHeartImage,
  '🎓': graduationCapImage,
  '🎯': directHitImage,
  '👍': thumbsUpImage,
  '💡': lightBulbImage,
  '🔍': magnifyingGlassTiltedLeftImage,
  '😷': faceWithMedicalMask,
  '🚀': rocketImage,
  '🚦': verticalTrafficLightImage,
} as const


interface Props {
  children: string
  size: number
  style?: React.CSSProperties
}


const Emoji = (props: Props): React.ReactElement => {
  const {children, size, style} = props
  const image = EmojisDict[children as keyof typeof EmojisDict]
  const emojiStyle = useMemo((): React.CSSProperties => ({
    display: 'inline-block',
    fontSize: .8 * size,
    height: size,
    lineHeight: 1,
    textAlign: 'center',
    width: size,
    ...style,
  }), [size, style])
  if (image) {
    return <img style={emojiStyle} alt="" src={image} />
  }
  // Fallback on displaying a simple emoji of the proper size.
  return <span style={emojiStyle}>{children}</span>
}
Emoji.propTypes = {
  children: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
  style: PropTypes.object,
}


export default React.memo(Emoji)

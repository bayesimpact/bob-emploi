import React, {useMemo} from 'react'

import bobHeadImage from 'images/bob-head.svg'


type BobInteractionProps = {
  children: React.ReactNode
  style?: React.CSSProperties
}

const bobStyle: React.CSSProperties = {
  height: 29.5,
  marginRight: 10,
  width: 27,
}
const BobInteraction = ({children, style}: BobInteractionProps): React.ReactElement|null => {
  const interactionStyle: React.CSSProperties = useMemo(() => ({
    backgroundColor: colors.NEW_GREY,
    borderRadius: 20,
    display: 'flex',
    fontSize: 14,
    padding: 15,
    ...style,
  }), [style])
  if (!children) {
    return null
  }
  return <div style={interactionStyle}>
    <img src={bobHeadImage} alt={config.productName} style={bobStyle} />
    {children}
  </div>
}
export default React.memo(BobInteraction)

import PropTypes from 'prop-types'
import React, {useState} from 'react'
import VisibilitySensor from 'react-visibility-sensor'

import useMedia from 'hooks/media'


interface Props extends Omit<React.HTMLProps<HTMLDivElement>, 'ref'> {
  children: ReactStylableElement | null | (ReactStylableElement|null)[]
  isAnimationEnabled?: boolean
  maxNumChildren?: number
}


const AppearingList = (props: Props): React.ReactElement => {
  const isForPrint = useMedia() === 'print'
  const {children, isAnimationEnabled = !isForPrint, maxNumChildren, ...extraProps} = props
  const [isShown, setIsShown] = useState(!isAnimationEnabled)
  const validChildren = React.Children.toArray(children).filter(
    (c): c is ReactStylableElement => !!c,
  )
  const itemStyle = (index: number, style?: RadiumCSSProperties): RadiumCSSProperties => ({
    opacity: isShown ? 1 : 0,
    ...(isAnimationEnabled ? {
      transition: `opacity 300ms ease-in ${index * 700 / validChildren.length}ms`,
    } : undefined),
    ...style,
  })
  const shownChildren = maxNumChildren ? validChildren.slice(0, maxNumChildren) : validChildren
  return <VisibilitySensor
    active={!isShown} intervalDelay={250} partialVisibility={true}
    onChange={setIsShown}>
    <div {...extraProps}>
      {shownChildren.map((item, index): React.ReactNode =>
        React.cloneElement(item, {
          key: item.key || index,
          style: itemStyle(index, item.props.style),
        }))}
    </div>
  </VisibilitySensor>
}
AppearingList.PropTypes = {
  children: PropTypes.arrayOf(PropTypes.node.isRequired),
  isAnimationEnabled: PropTypes.bool,
  maxNumChildren: PropTypes.number,
}


export default React.memo(AppearingList)

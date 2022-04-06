import React, {useMemo, useRef} from 'react'

import useMedia from 'hooks/media'
import useOnScreen from 'hooks/on_screen'


type ValidChild = React.ReactElement

interface Props extends Omit<React.HTMLProps<HTMLUListElement>, 'ref'> {
  children: ValidChild | null | readonly (ValidChild|null)[]
  isAnimationEnabled?: boolean
  maxNumChildren?: number
}


const AppearingList = (props: Props): React.ReactElement => {
  const isForPrint = useMedia() === 'print'
  const {children, isAnimationEnabled = !isForPrint, maxNumChildren, style, ...extraProps} = props
  const domRef = useRef<HTMLUListElement>(null)
  const isShown = useOnScreen(domRef, {isActive: isAnimationEnabled, isForAppearing: true})
  const validChildren = React.Children.toArray(children).filter(
    (c): c is ValidChild => !!c,
  )
  const itemStyle = (index: number): RadiumCSSProperties => ({
    opacity: isShown ? 1 : 0,
    ...(isAnimationEnabled ? {
      transition: `opacity 300ms ease-in ${index * 700 / validChildren.length}ms`,
    } : undefined),
  })
  const shownChildren = maxNumChildren ? validChildren.slice(0, maxNumChildren) : validChildren
  const finalStyle = useMemo((): React.CSSProperties => ({
    listStyleType: 'none',
    // TODO(cyrille): Consider adding this to App.css for all ul.
    margin: 0,
    padding: 0,
    ...style,
  }), [style])
  return <ul style={finalStyle} ref={domRef} {...extraProps}>
    {shownChildren.map((item, index): React.ReactNode => <li key={index} style={itemStyle(index)}>
      {item}
    </li>)}
  </ul>
}


export default React.memo(AppearingList)

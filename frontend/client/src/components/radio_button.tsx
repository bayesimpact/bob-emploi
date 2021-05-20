import React from 'react'

import {useHoverAndFocus} from 'components/radium'
import useFocusableRefAs, {Focusable} from 'hooks/focus'


interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isHovered?: boolean
  isSelected?: boolean
  size?: number
}


const RadioButton = (props: Props, ref: React.Ref<Focusable>): React.ReactElement => {
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus(props)
  const {isSelected, size = 20, style, isHovered: omittedIsHovered, ...otherProps} = props
  const isHighlighted = isFocused || isHovered
  const {onClick} = otherProps

  const outerCircleStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderColor: isHighlighted ? colors.COOL_GREY : colors.PINKISH_GREY,
    borderRadius: '50%',
    borderStyle: 'solid',
    borderWidth: 1,
    ...onClick && {cursor: 'pointer'},
    height: size,
    position: 'absolute',
    width: size,
  }
  const innerCircleStyle: React.CSSProperties = {
    backgroundColor: colors.BOB_BLUE,
    borderRadius: '50%',
    height: size / 2,
    left: size / 4 - 1,
    position: 'absolute',
    top: size / 4 - 1,
    width: size / 2,
  }
  const containerStyle: React.CSSProperties = {
    cursor: 'pointer',
    display: 'inline-flex',
    height: size,
    padding: 0,
    position: 'relative',
    width: size,
    ...style,
  }
  return <button
    style={containerStyle} ref={useFocusableRefAs(ref)}
    {...otherProps} {...handlers} role="radio"
    aria-checked={isSelected}>
    <span style={outerCircleStyle}>
      {isSelected ? <span style={innerCircleStyle} /> : null}
    </span>
  </button>
}


export default React.memo(React.forwardRef(RadioButton))

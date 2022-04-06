import React from 'react'

import {useHoverAndFocus} from 'components/radium'
import type {Focusable} from 'hooks/focus'
import useFocusableRefAs from 'hooks/focus'

export type {Focusable} from 'hooks/focus'


interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inputStyle?: React.CSSProperties
  isHovered?: boolean
  isSelected?: boolean
  size?: number
}

interface CircleProps {
  isHighlighted: boolean
  isSelected: boolean
  size?: number
  style?: React.CSSProperties
}

export const RadioCircle = (props: CircleProps): React.ReactElement => {
  const {isHighlighted, isSelected, size = 20, style} = props
  const outerCircleStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderColor: isHighlighted ? colors.COOL_GREY : colors.PINKISH_GREY,
    borderRadius: '50%',
    borderStyle: 'solid',
    borderWidth: 1,
    height: size,
    position: 'relative',
    width: size,
    ...style,
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
  return <span style={outerCircleStyle}>
    {isSelected ? <span style={innerCircleStyle} /> : null}
  </span>
}

const RadioButton = (props: Props, ref: React.Ref<Focusable>): React.ReactElement => {
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus(props)
  const {inputStyle, isSelected, size = 20, style, isHovered: omittedIsHovered,
    ...otherProps} = props
  const isHighlighted = isFocused || isHovered

  const circleStyle: React.CSSProperties = {
    position: 'absolute',
    ...otherProps.onClick && {cursor: 'pointer'},
    ...inputStyle,
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
    {...otherProps} {...handlers} role="radio" type="button"
    aria-checked={isSelected}>
    <RadioCircle
      size={size} isHighlighted={isHighlighted} isSelected={!!isSelected} style={circleStyle} />
  </button>
}


export default React.memo(React.forwardRef(RadioButton))

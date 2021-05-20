import CheckIcon from 'mdi-react/CheckIcon'
import React from 'react'

import {useHoverAndFocus} from 'components/radium'
import useFocusableRefAs, {Focusable} from 'hooks/focus'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isHovered?: boolean
  isSelected?: boolean
  size?: number
}


const Checkbox = (props: Props, ref: React.Ref<Focusable>): React.ReactElement => {
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus(props)
  const {isSelected, size = 20, style, isHovered: omittedIsHovered, ...otherProps} = props
  const isHighlighted = isFocused || isHovered

  const outerBoxStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: isSelected ? colors.BOB_BLUE : '#fff',
    borderColor: isSelected ? colors.BOB_BLUE : (
      isHighlighted ? colors.COOL_GREY : colors.PINKISH_GREY
    ),
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    fontSize: 16,
    height: size,
    justifyContent: 'center',
    position: 'absolute',
    width: size,
  }
  const containerStyle: React.CSSProperties = {
    cursor: 'pointer',
    display: 'inline-flex',
    height: outerBoxStyle.height,
    padding: 0,
    position: 'relative',
    width: outerBoxStyle.width,
    ...style,
  }
  return <button
    style={containerStyle} ref={useFocusableRefAs(ref)}
    {...otherProps} {...handlers} role="checkbox"
    aria-checked={isSelected}>
    <span style={outerBoxStyle}>
      {isSelected ? <CheckIcon style={{fill: '#fff', width: 16}} /> : null}
    </span>
  </button>
}


export default React.memo(React.forwardRef(Checkbox))

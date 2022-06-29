import CheckIcon from 'mdi-react/CheckIcon'
import React, {useMemo} from 'react'

import {useHoverAndFocus} from 'components/radium'
import type {Focusable} from 'hooks/focus'
import useFocusableRefAs from 'hooks/focus'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inputStyle?: React.CSSProperties
  isHovered?: boolean
  isSelected?: boolean
  size?: number
}


const Checkbox = (props: Props, ref: React.Ref<Focusable>): React.ReactElement => {
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus(props)
  const {inputStyle, isSelected, size = 20, style, isHovered: omittedIsHovered,
    ...otherProps} = props
  const isHighlighted = isFocused || isHovered

  const outerBoxStyle = useMemo((): React.CSSProperties => ({
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
    ...inputStyle,
  }), [inputStyle, isHighlighted, isSelected, size])
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
    {...otherProps} {...handlers} role="checkbox" type="button"
    aria-checked={isSelected}>
    <span style={outerBoxStyle}>
      {isSelected ?
        <CheckIcon style={{fill: '#fff', width: 16}} aria-hidden={true} focusable={false} /> :
        null}
    </span>
  </button>
}


export default React.memo(React.forwardRef(Checkbox))

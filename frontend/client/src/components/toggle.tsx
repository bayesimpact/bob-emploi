import React, {useMemo} from 'react'

import {FastTransitions} from 'components/theme'
import type {Focusable} from 'hooks/focus'
import useFocusableRefAs from 'hooks/focus'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inputStyle?: React.CSSProperties
  isHovered?: boolean
  isSelected?: boolean
  size?: number
}


const Toggle = (props: Props, ref: React.Ref<Focusable>): React.ReactElement => {
  const {inputStyle, isSelected, size = 50, style, isHovered: omittedIsHovered,
    ...otherProps} = props

  const outerBoxStyle = useMemo((): React.CSSProperties => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ['WebkitPrintColorAdjust' as any]: 'exact',
    alignItems: 'center',
    backgroundColor: isSelected ? colors.BOB_BLUE : colors.MODAL_PROJECT_GREY,
    borderColor: isSelected ? colors.BOB_BLUE : colors.MODAL_PROJECT_GREY,
    borderRadius: size / 4,
    borderStyle: 'solid',
    borderWidth: 1,
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    fontSize: 16,
    height: size / 2,
    justifyContent: 'center',
    position: 'absolute',
    width: size,
    ...inputStyle,
    ...FastTransitions,
  }), [inputStyle, isSelected, size])
  const containerStyle: React.CSSProperties = useMemo((): React.CSSProperties => ({
    cursor: 'pointer',
    display: 'inline-flex',
    height: size / 2,
    padding: 0,
    position: 'relative',
    width: size,
    ...style,
  }), [size, style])
  const innerBoxStyle: React.CSSProperties = useMemo((): React.CSSProperties => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ['WebkitPrintColorAdjust' as any]: 'exact',
    backgroundColor: '#fff',
    borderRadius: size / 2,
    height: size / 2 - 4,
    left: isSelected ? (size / 2 + 1) : 2,
    position: 'absolute',
    width: size / 2 - 4,
    ...FastTransitions,
  }), [isSelected, size])
  return <button
    style={containerStyle} ref={useFocusableRefAs(ref)}
    {...otherProps} role="checkbox" aria-checked={isSelected} type="button">
    <span style={outerBoxStyle}>
      <span style={innerBoxStyle} />
    </span>
  </button>
}


export default React.memo(React.forwardRef(Toggle))

import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useMemo, useState} from 'react'

import type {Focusable} from 'hooks/focus'

import Checkbox from 'components/checkbox'
import RadioButton from 'components/radio_button'


const TOGGLE_INPUTS = {
  checkbox: Checkbox,
  radio: RadioButton,
} as const


interface Props extends
  Pick<React.ComponentPropsWithoutRef<typeof RadioButton>,
  'role'|'aria-describedby'|'aria-invalid'|'aria-required'> {
  inputStyle?: React.CSSProperties
  isSelected?: boolean
  label: React.ReactNode
  onBlur?: (event?: React.FocusEvent<Element>) => void
  onClick?: (event?: React.MouseEvent<Element>) => void
  onFocus?: (event?: React.FocusEvent<Element>) => void
  style?: React.CSSProperties
  type: keyof typeof TOGGLE_INPUTS
}


interface ToggleInputProps extends React.ComponentPropsWithoutRef<typeof Checkbox> {
  ref: React.Ref<Focusable>
}

// Label + checkbox / radio
// - focusing programmatically from parent
// - hovering on label changes the style of the the input
// - click on the label calls onClick
// - radio groups should work
//   - one and only one of the input has a tabIndex
//   - using arrow keys changes the focus
// - one tabIndex except when disabled and for multiple radios
const LabeledToggle = (props: Props, ref: React.Ref<Focusable>): React.ReactElement => {
  const {inputStyle, isSelected, label, onClick, role, style, type, ...otherProps} = props
  const [isHovered, setIsHovered] = useState(false)

  const onMouseEnter = useCallback((): void => setIsHovered(true), [])
  const onMouseLeave = useCallback((): void => setIsHovered(false), [])

  const handleClick = useCallback((event: React.MouseEvent<Element>): void => {
    // Prevent a weird double event when clicking on the input itself.
    event?.preventDefault()
    onClick?.(event)
  }, [onClick])

  const containerStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    listStyle: 'none',
    marginBottom: 7,
    ...style,
  }
  const ToggleInput: React.ComponentType<ToggleInputProps> = TOGGLE_INPUTS[type]
  const toggleId = useMemo(_uniqueId, [])
  // Adding a visual hovering effect on the whole component for users with a cursor.
  // eslint-disable-next-line jsx-a11y/no-static-element-interactions
  return <span style={containerStyle}
    onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} role={role === type ? undefined : role}>
    <ToggleInput
      style={{flex: 'none'}} ref={ref} onClick={onClick && handleClick}
      {...otherProps} {...{inputStyle, isHovered, isSelected}} id={toggleId} />
    <label style={{paddingLeft: 10}} htmlFor={toggleId}>
      {label}
    </label>
  </span>
}


export default React.memo(React.forwardRef(LabeledToggle))

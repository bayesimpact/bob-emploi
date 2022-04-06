import React, {useCallback, useImperativeHandle, useMemo, useRef, useState} from 'react'

import type {Focusable} from 'hooks/focus'
import useFocusableRefAs from 'hooks/focus'

import Button from 'components/button'
import LabeledToggle from 'components/labeled_toggle'

// A Button but with a Focusable ref.
const FocusableButtonBase = (
  props: React.ComponentPropsWithoutRef<typeof Button>, ref?: React.Ref<Focusable>,
): React.ReactElement => {
  const buttonRef = useFocusableRefAs<HTMLButtonElement>(ref)
  return <Button {...props} ref={buttonRef} />
}
const FocusableButton = React.memo(React.forwardRef(FocusableButtonBase))

type LabeledToggleProps = React.ComponentPropsWithoutRef<typeof LabeledToggle>

interface ValuedLabeledToggleProps<T> extends Omit<LabeledToggleProps, 'onClick'|'onFocus'|'type'> {
  index: number
  role?: 'checkbox' | 'radio'
  onClick?: () => void
  onFocus?: () => void
  type: 'radio'|'button'
  value: T
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
const ValuedLabeledToggleBase = <T extends unknown>(
  props: ValuedLabeledToggleProps<T>, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {index: omittedIndex, type, value: omittedValue, ...otherProps} = props
  const {isSelected, label, style, ...otherButtonProps} = otherProps
  const buttonStyle = useMemo((): React.CSSProperties => ({
    // Avoid transition as changing types make the button's height flicker otherwise.
    transition: 'none',
    ...style,
  }), [style])
  if (type === 'button') {
    return <FocusableButton
      ref={ref}
      style={buttonStyle} {...otherButtonProps} isRound={true}
      type={isSelected ? undefined : 'outline'}>
      {label}
    </FocusableButton>
  }
  return <LabeledToggle type={type} ref={ref} {...otherProps} />
}
// TODO(pascal): Remove the type assertion once we understand how
// https://github.com/Microsoft/TypeScript/issues/9366 should work.
const ValuedLabeledToggle = React.memo(React.forwardRef(ValuedLabeledToggleBase)) as <T>(
  props: ValuedLabeledToggleProps<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement


interface Props<T> extends
  Pick<
  React.HTMLProps<'div'>,
  'aria-labelledby'|'aria-describedby'|'aria-invalid'|'aria-required'> {
  children?: React.ReactNode
  childStyle?: React.CSSProperties
  onChange: (value: T) => void
  options: readonly {
    name: React.ReactNode
    value: T
  }[]
  style?: React.CSSProperties
  type?: 'radio'|'button'
  value?: T
}


interface RadioGroupContainerProps<T extends HTMLElement> {
  onFocus: () => void
  onKeyDown: (event: React.KeyboardEvent<T>) => void
  ref: React.Ref<T>
  role: 'radiogroup'
  tabIndex: -1
}

interface RadioGroupChildProps {
  'aria-checked': boolean
  index: number
  isSelected: boolean
  onBlur?: () => void
  onClick: () => void
  onFocus: () => void
  ref?: React.RefObject<Focusable>
  role: 'radio'
  tabIndex: 0|-1
}

interface RadioGroupHooksProps<T> {
  onChange: (value: T) => void
  ref?: React.Ref<Focusable>
  selectedIndex: number
  values: readonly T[]
}

interface RadioGroupHooksResult<T extends HTMLElement> {
  childProps: (index: number) => RadioGroupChildProps
  containerProps: RadioGroupContainerProps<T>
}


export const useRadioGroup = <T extends HTMLElement, V>(
  {values, onChange, selectedIndex, ref}: RadioGroupHooksProps<V>,
): RadioGroupHooksResult<T> => {
  const count = values.length
  const [focusIndex, setFocusIndex] = useState(-1)
  const optionsRef = useRef<readonly React.RefObject<Focusable>[] | undefined>()
  if (!optionsRef.current || optionsRef.current.length !== count) {
    optionsRef.current = Array.from(
      {length: count},
      (): React.RefObject<Focusable> => React.createRef(),
    )
  }

  const focusOn = useCallback((focusIndex: number): void => {
    if (!optionsRef.current) {
      return
    }
    optionsRef.current?.[focusIndex]?.current?.focus()
  }, [])

  const selectOther = useCallback((delta: number): void => {
    if (focusIndex === -1) {
      return
    }
    const newIndex = (focusIndex + delta + count) % count
    focusOn(newIndex)
    onChange(values[newIndex])
  }, [focusIndex, focusOn, onChange, values, count])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<T>): void => {
    const {keyCode} = event
    // Left or Up.
    if (keyCode === 37 || keyCode === 38) {
      selectOther(-1)
    }
    // Right or Down.
    if (keyCode === 39 || keyCode === 40) {
      selectOther(1)
    }
  }, [selectOther])

  const clearFocus = useCallback((): void => setFocusIndex(-1), [])

  const focused = focusIndex !== -1 ? focusIndex : selectedIndex >= 0 ? selectedIndex : 0

  const containerRef = useRef<T>(null)
  const focus = useCallback((): void => {
    if (containerRef.current?.contains(document.activeElement)) {
      // Already focused on a button inside the group.
      return
    }
    focusOn(focused)
  }, [focusOn, focused])
  useImperativeHandle(ref, (): Focusable => ({focus}))

  const childFocusFunctions = useMemo(
    () => Array.from({length: count}, (unusedValue, index) => () => setFocusIndex(index)),
    [count],
  )
  const childClickFunctions = useMemo(
    () => values.map((value) => () => onChange(value)),
    [onChange, values],
  )

  return {
    childProps: (index: number): RadioGroupChildProps => ({
      'aria-checked': index === selectedIndex,
      'index': index,
      'isSelected': index === selectedIndex,
      'onBlur': index === focusIndex ? clearFocus : undefined,
      'onClick': childClickFunctions[index],
      'onFocus': childFocusFunctions[index],
      'ref': optionsRef.current?.[index],
      'role': 'radio',
      'tabIndex': (selectedIndex < 0 && focusIndex === -1 || focused === index) ? 0 : -1,
    }),
    containerProps: {
      onFocus: focus,
      onKeyDown: handleKeyDown,
      ref: containerRef,
      role: 'radiogroup',
      tabIndex: -1,
    },
  }
}

const RadioGroup =
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
<T extends unknown>(props: Props<T>, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {
    children, childStyle, onChange, options, style, type = 'radio', value,
    ...otherProps
  } = props
  const selectedIndex = options.findIndex((option) => option.value === value)
  const values = useMemo(() => options.map(({value}) => value), [options])
  const {childProps, containerProps} =
    useRadioGroup<HTMLDivElement, T>({onChange, ref, selectedIndex, values})

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    ...style,
  }
  return <div style={containerStyle} {...otherProps} {...containerProps}>
    {options.map((option, index): React.ReactNode => {
      return <ValuedLabeledToggle<T>
        key={option.value + ''} label={option.name} type={type} style={childStyle}
        {...childProps(index)}
        value={option.value} />
    })}
    {children}
  </div>
}
// TODO(pascal): Remove the type assertion once we understand how
// https://github.com/Microsoft/TypeScript/issues/9366 should work.
export default React.memo(React.forwardRef(RadioGroup)) as <T>(
  props: Props<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement

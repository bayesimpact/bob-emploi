import React, {useCallback, useImperativeHandle, useMemo, useRef, useState} from 'react'

import useFocusableRefAs, {Focusable} from 'hooks/focus'

import Button from 'components/button'
import LabeledToggle from 'components/labeled_toggle'


type LabeledToggleProps = React.ComponentPropsWithoutRef<typeof LabeledToggle>

interface ValuedLabeledToggleProps<T> extends Omit<LabeledToggleProps, 'onClick'|'onFocus'|'type'> {
  index: number
  onClick?: (value: T) => void
  onFocus?: (index: number) => void
  type: 'radio'|'button'
  value: T
}

const ValuedLabeledToggleBase = <T extends unknown>(
  props: ValuedLabeledToggleProps<T>, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {index, onClick, onFocus, type, value, ...otherProps} = props
  const handleClick = useCallback((): void => {
    onClick?.(value)
  }, [onClick, value])
  const handleFocus = useCallback((): void => {
    onFocus?.(index)
  }, [onFocus, index])
  const {isSelected, label, style, ...otherButtonProps} = otherProps
  const buttonStyle = useMemo((): React.CSSProperties => ({
    // Avoid transition as changing types make the button's height flicker otherwise.
    transition: 'none',
    ...style,
  }), [style])
  const buttonRef = useFocusableRefAs<HTMLButtonElement>(ref)
  if (type === 'button') {
    return <Button
      ref={buttonRef} onClick={onClick && handleClick} onFocus={onFocus && handleFocus}
      style={buttonStyle} {...otherButtonProps} isRound={true}
      type={isSelected ? undefined : 'outline'}>
      {label}
    </Button>
  }
  return <LabeledToggle
    type={type} ref={ref} onClick={onClick && handleClick} onFocus={onFocus && handleFocus}
    {...otherProps} />
}
// TODO(pascal): Remove the type assertion once we understand how
// https://github.com/Microsoft/TypeScript/issues/9366 should work.
const ValuedLabeledToggle = React.memo(React.forwardRef(ValuedLabeledToggleBase)) as <T>(
  props: ValuedLabeledToggleProps<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement


interface Props<T> {
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
  index: number
  isSelected: boolean
  onBlur?: () => void
  onFocus: (index: number) => void
  ref?: React.RefObject<Focusable>
  role: 'radio'
  tabIndex: 0|-1
}

interface RadioGroupHooksResult<T extends HTMLElement> {
  childProps: (index: number) => RadioGroupChildProps
  containerProps: RadioGroupContainerProps<T>
}


export const useRadioGroup = <T extends HTMLElement>(
  count: number, selectedIndex: number, ref?: React.Ref<Focusable>,
): RadioGroupHooksResult<T> => {
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

  const focusOnOther = useCallback((delta: number): void => {
    if (focusIndex === -1) {
      return
    }
    focusOn(focusIndex + delta)
  }, [focusIndex, focusOn])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<T>): void => {
    const {keyCode} = event
    // Left or Up.
    if (keyCode === 37 || keyCode === 38) {
      focusOnOther(-1)
    }
    // Right or Down.
    if (keyCode === 39 || keyCode === 40) {
      focusOnOther(1)
    }
  }, [focusOnOther])

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

  return {
    childProps: (index: number): RadioGroupChildProps => ({
      index,
      isSelected: index === selectedIndex,
      onBlur: index === focusIndex ? clearFocus : undefined,
      onFocus: setFocusIndex,
      ref: optionsRef.current?.[index],
      role: 'radio',
      tabIndex: focused === index ? 0 : -1,
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
<T extends unknown>(props: Props<T>, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {childStyle, onChange, options, style, type = 'radio', value} = props
  const selectedIndex = options.findIndex((option) => option.value === value)
  const {childProps, containerProps} =
    useRadioGroup<HTMLDivElement>(options.length, selectedIndex, ref)

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    ...style,
  }
  return <div style={containerStyle} {...containerProps}>
    {options.map((option, index): React.ReactNode => {
      return <ValuedLabeledToggle<T>
        key={option.value + ''} label={option.name} type={type} style={childStyle}
        {...childProps(index)}
        value={option.value}
        onClick={onChange} />
    })}
  </div>
}
// TODO(pascal): Remove the type assertion once we understand how
// https://github.com/Microsoft/TypeScript/issues/9366 should work.
export default React.memo(React.forwardRef(RadioGroup)) as <T>(
  props: Props<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement

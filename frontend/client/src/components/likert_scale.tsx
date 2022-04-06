import React, {useMemo} from 'react'

import type {Focusable} from 'hooks/focus'
import useFocusableRefAs from 'hooks/focus'
import {useIsTabNavigationUsed} from 'hooks/tab_navigation'

import {colorToAlpha} from 'components/colors'
import {useHoverAndFocus} from 'components/radium'
import {useRadioGroup} from 'components/radio_group'


interface ChoiceProps<T> {
  value: T
  name: string
}

interface ButtonProps<T> {
  'aria-checked': boolean
  content: ChoiceProps<T>
  index: number
  isSelected: boolean
  onBlur?: () => void
  onClick: () => void
  onFocus: () => void
  role?: string
  tabIndex?: number
}

const scoreButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.PALE_BLUE,
  display: 'flex',
  flex: 1,
  justifyContent: 'center',
  outline: 'none',
  padding: 14.5,
}

const ButtonBase = <T extends string|number>(
  props: ButtonProps<T>, ref?: React.Ref<Focusable>,
): React.ReactElement => {
  const {content: {name}, index, isSelected, onBlur, onFocus, ...otherProps} = props
  const isTabNavigationUsed = useIsTabNavigationUsed(true)
  const {
    isFocused,
    isHovered,
    ...radiumHandlers
  } = useHoverAndFocus<HTMLButtonElement>({onBlur, onFocus})
  const isActive = isFocused && isTabNavigationUsed || isHovered
  const circleStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: isSelected ? colors.BOB_BLUE : 'transparent',
    border: 'solid 2px',
    borderColor: isActive ? colors.BOB_BLUE : isSelected ? 'transparent' : colorToAlpha('#000', .3),
    borderRadius: 30,
    boxShadow: (isActive && isSelected ?
      `0px 0px 0px 2px ${colors.PALE_BLUE}, 0px 0px 0px 4px ${colors.BOB_BLUE}` : ''),
    flexShrink: 0,
    height: 20,
    width: 20,
  }), [isActive, isSelected])
  const title = name ? `${index + 1} ${name}` : ((index + 1) + '')
  return <button
    type="button" style={scoreButtonStyle}
    ref={useFocusableRefAs(ref)} title={title}
    {...otherProps} {...radiumHandlers}>
    <span style={circleStyle} />
  </button>
}
const Button = React.memo(React.forwardRef(ButtonBase)) as <T extends string|number>(
  props: ButtonProps<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement

interface TextScaleProps {
  scale: readonly ChoiceProps<unknown>[]
  style?: React.CSSProperties
}

const TextScaleBase = ({scale, style}: TextScaleProps): React.ReactElement => {
  const names = useMemo(
    () => scale.filter(content => !!content.name).map(content => content.name),
    [scale])
  const nameStyles = useMemo(() => names.map((name, index): React.CSSProperties => ({
    flex: 1,
    textAlign: index ? (index === names.length - 1) ? 'right' : 'center' : 'left',
  })), [names])
  const textContainerStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    ...style,
  }), [style])
  return <div style={textContainerStyle} aria-hidden={true}>
    {names.map((name, index): React.ReactNode =>
      <span key={`text-${index}`} style={nameStyles[index]}>
        {name}
      </span>)}
  </div>
}
export const TextScale = React.memo(TextScaleBase)

export interface Props<T> {
  ['aria-labelledby']?: string
  ['aria-describedby']?: string
  id?: string
  isTextShown?: boolean
  value?: T
  onChange: (value: T) => void
  scale: readonly ChoiceProps<T>[]
  style?: React.CSSProperties
}

const containerStyle: React.CSSProperties = {
  alignItems: 'center',
  borderRadius: 10,
  display: 'flex',
  fontSize: 13,
  fontWeight: 'normal',
  gap: 5,
  overflow: 'hidden',
  padding: 0,
}
const textBelowStyle: React.CSSProperties = {
  marginTop: 10,
}

const LikertScale = <T extends string|number>(
  props: Props<T>, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {isTextShown = true, onChange, scale, style, value, ...otherProps} = props
  const selectedIndex = scale.findIndex((content) => content.value === value)
  const values = useMemo(() => scale.map(({value}) => value), [scale])
  const {childProps, containerProps} =
    useRadioGroup<HTMLDivElement, T>({onChange, ref, selectedIndex, values})
  return <div style={style}>
    <div style={containerStyle} {...containerProps} {...otherProps}>
      {scale.map((content, index): React.ReactNode => <Button
        key={index} content={content} {...childProps(index)} />)}
    </div>
    {isTextShown ? <TextScale scale={scale} style={textBelowStyle} /> : null}
  </div>
}

// TODO(pascal): Remove the type assertion once we understand how
// https://github.com/Microsoft/TypeScript/issues/9366 should work.
export default React.memo(React.forwardRef(LikertScale)) as <T extends string|number>(
  props: Props<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement

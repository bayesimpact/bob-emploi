import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import type {LocalizableString} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import type {Focusable} from 'hooks/focus'
import useFocusableRefAs from 'hooks/focus'

import {useRadioGroup} from 'components/radio_group'


interface EvaluationProps<T> {
  emoji: string
  evaluation: T
  evaluationText: LocalizableString
}

interface ButtonProps<T> {
  'aria-checked': boolean
  content: EvaluationProps<T>
  evaluation: T
  index: number
  isFirst: boolean
  isLast: boolean
  isSelected: boolean
  onBlur?: () => void
  onClick: () => void
  onFocus: () => void
  role?: string
  selectedStyle?: React.CSSProperties
  style?: React.CSSProperties
  tabIndex?: number
}

const emojiStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 14 : 16,
  lineHeight: 1,
  marginBottom: 8,
}

const EvalButtonBase = <T extends string|number>(
  props: ButtonProps<T>, ref?: React.Ref<Focusable>,
): React.ReactElement => {
  const {content, index: omittedIndex, isFirst, isLast, isSelected, selectedStyle, style,
    ...otherProps} = props
  const [translate] = useTranslation('components')
  const {emoji, evaluationText} = content
  const scoreButtonStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    borderBottom: 'solid 1px',
    borderLeft: isFirst ? 'solid 1px' : 'none',
    borderRadius: isFirst ? '2px 0px 0px 2px' : isLast ? '0px 2px 2px 0px' : 0,
    borderRight: 'solid 1px',
    borderTop: 'solid 1px',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: isMobileVersion ? 44 : 52,
    padding: isMobileVersion ? 8 : '8px 20px',
    textAlign: 'center',
    ...style,
    ...isSelected && selectedStyle,
  }), [isFirst, isLast, isSelected, style, selectedStyle])
  return <button
    type="button" style={scoreButtonStyle}
    ref={useFocusableRefAs(ref)} {...otherProps}>
    <span style={emojiStyle} aria-hidden={true}>
      {emoji}
    </span>
    <span style={{fontSize: isMobileVersion ? 12 : 14}}>{translate(...evaluationText)}</span>
  </button>
}
const EvalButton = React.memo(React.forwardRef(EvalButtonBase)) as <T extends string|number>(
  props: ButtonProps<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement

interface ButtonsProps<T> {
  ['aria-labelledby']: string
  buttonSelectedStyle?: React.CSSProperties
  buttonStyle?: React.CSSProperties
  evaluation?: T
  onScoreChange: (evaluation: T) => void
  scale: readonly EvaluationProps<T>[]
}

const scoreButtonsContainerStyle: React.CSSProperties = {
  display: 'flex',
  margin: '10px 0',
  padding: 0,
}

const EvalButtons = <T extends string|number>(props: ButtonsProps<T>): React.ReactElement => {
  const {buttonStyle, buttonSelectedStyle, onScoreChange, scale, evaluation, ...otherProps} = props
  const values = useMemo(() => scale.map(({evaluation}) => evaluation), [scale])
  const selectedIndex = scale.findIndex((content) => content.evaluation === evaluation)
  const {childProps, containerProps} = useRadioGroup<HTMLDivElement, T>(
    {onChange: onScoreChange, selectedIndex, values})
  return <div style={scoreButtonsContainerStyle} {...containerProps} {...otherProps}>
    {scale.map((content, index): React.ReactNode => <EvalButton
      key={index}
      isFirst={index === 0} isLast={index === scale.length - 1} evaluation={content.evaluation}
      content={content}
      style={buttonStyle} selectedStyle={buttonSelectedStyle} {...childProps(index)} />)}
  </div>
}

const typedMemo: <T>(c: T) => T = React.memo
export default typedMemo(EvalButtons)

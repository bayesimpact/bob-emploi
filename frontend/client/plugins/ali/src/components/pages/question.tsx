import React, {useCallback, useImperativeHandle, useLayoutEffect, useRef, useState} from 'react'
import {Redirect, useHistory} from 'react-router-dom'

import useFastForward from 'hooks/fast_forward'

import {useHoverAndFocus} from 'components/radium'
import notAtAllImage from '../../images/not-at-all.png'
import notReallyImage from '../../images/not-really.png'
import yesImage from '../../images/yes.png'
import yesClearlyImage from '../../images/yes-clearly.png'

import Button from '../button'
import GenericPage from '../page'
import allPossibleAnswers, {AnswerType, QuestionType} from '../answers'
import {Routes} from '../../store'


const levelColors = {
  '-1': colors.BUDDHA_GOLD,
  '-2': colors.BROWN_YELLOW,
  '1': colors.SUPERNOVA,
  '2': colors.SUNFLOWER_YELLOW,
}


export interface Focusable {
  focus: () => void
}


const getAnswerText = (type: QuestionType, answer: AnswerType): string => {
  for (const possibleAnswer of allPossibleAnswers[type]) {
    if (possibleAnswer.value === answer) {
      return possibleAnswer.name
    }
  }
  return ''
}


interface AnswerCardProps {
  answer?: React.ReactNode
  isSelected?: boolean
  onBlur?: () => void
  onClick: (value: AnswerType) => void
  onFocus?: (value: AnswerType) => void
  style?: React.CSSProperties
  tabIndex?: number
  value: AnswerType
}


// TODO(cyrille): Consider factorizing with HubCard.
const AnswerCardBase = (props: AnswerCardProps, ref: React.Ref<Focusable>): React.ReactElement => {
  const {answer, isSelected, onBlur, onClick, onFocus, style, tabIndex, value} = props
  const handleClick = useCallback((): void => onClick(value), [onClick, value])
  const handleFocus = useCallback((): void => onFocus?.(value), [onFocus, value])
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus({
    onBlur,
    onFocus: onFocus && handleFocus,
  })

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    border: 'none',
    borderRadius: 15,
    boxShadow: isFocused || isHovered ?
      '0px 10px 15px 0 rgba(0, 0, 0, 0.2)' :
      '0px 2px 5px 0 rgba(0, 0, 0, 0.2)',
    color: isSelected ? colors.SAP_GREEN : 'inherit',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: isSelected ? 'bold' : 600,
    margin: 15,
    padding: '25px 20px 20px',
    position: 'relative',
    textAlign: 'center',
    transition: '450ms',
    ...style,
  }
  const borderStyle: React.CSSProperties = {
    border: `solid 4px ${colors.PEA}`,
    borderRadius: cardStyle.borderRadius,
    bottom: 0,
    left: 0,
    opacity: (isHovered || isSelected || isFocused) ? 1 : 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: '450ms',
    zIndex: 1,
  }
  const outerCircleStyle: React.CSSProperties = {
    alignItems: 'center',
    border: `solid 1px ${isSelected ? colors.SAP_GREEN : colors.WARM_GREY}`,
    borderRadius: 10,
    display: 'flex',
    height: 20,
    justifyContent: 'center',
    margin: '10px auto 0',
    width: 20,
  }
  const innerCircleStyle = {
    backgroundColor: isSelected ? colors.PEA : 'transparent',
    borderRadius: 7,
    height: 14,
    width: 14,
  }
  const buttonRef = useRef<HTMLButtonElement>(null)
  useImperativeHandle(ref, (): Focusable => ({
    focus: (): void => {
      buttonRef.current?.focus()
    },
  }))
  return <button
    {...handlers} style={cardStyle} onClick={handleClick} aria-checked={isSelected} role="radio"
    ref={buttonRef} tabIndex={tabIndex}>
    <div style={borderStyle} />
    {answer}
    <div style={outerCircleStyle}>
      <div style={innerCircleStyle} />
    </div>
  </button>
}
const AnswerCard = React.memo(React.forwardRef(AnswerCardBase))


interface QuestionPageProps {
  children?: never
  answer?: AnswerType
  color?: string
  linkTo: string
  numSteps: number
  numStepsDone: number
  onAnswer: (answer: AnswerType) => void
  question: React.ReactNode
  title: React.ReactNode
  type: QuestionType
}


const QuestionPage = (props: QuestionPageProps): React.ReactElement => {
  const {answer: propsAnswer, color, linkTo, numSteps, numStepsDone, onAnswer, question, title,
    type} = props
  const [answer, setAnswer] = useState(propsAnswer)
  const history = useHistory()

  // Reset the internal state when question changes.
  useLayoutEffect((): void => {
    setAnswer(propsAnswer)
  }, [question, propsAnswer])

  const handleAnswer = useCallback((): void => {
    if (onAnswer && typeof answer !== 'undefined') {
      onAnswer(answer)
    }
  }, [onAnswer, answer])

  const possibleAnswers: readonly AnswerType[] = allPossibleAnswers[type].map(({value}) => value)
  const optionsRef = useRef<readonly React.RefObject<Focusable>[] | undefined>()
  if (!optionsRef.current || optionsRef.current.length !== possibleAnswers.length) {
    optionsRef.current = Array.from(
      {length: possibleAnswers.length},
      (): React.RefObject<Focusable> => React.createRef(),
    )
  }

  const [focusIndex, setFocusIndex] = useState(-1)
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
  const focusOnAnswer = useCallback((answer: AnswerType): void => {
    const index = possibleAnswers.indexOf(answer)
    if (index >= 0) {
      setFocusIndex(index)
    }
  }, [possibleAnswers])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
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

  const selectedIndex = answer === undefined ? -1 : possibleAnswers.indexOf(answer)
  const focused = focusIndex !== -1 ? focusIndex : selectedIndex >= 0 ? selectedIndex : 0
  const radiogroupRef = useRef<HTMLDivElement>(null)
  const handleFocus = useCallback((): void => {
    if (radiogroupRef.current?.contains(document.activeElement)) {
      // Already focused on a button inside the group.
      return
    }
    focusOn(focused)
  }, [focused, focusOn])

  // TODO(cyrille): Use the `to` parameter.
  useFastForward((): void => {
    if (answer === undefined) {
      const possibleAnswers = allPossibleAnswers[type]
      if (possibleAnswers) {
        setAnswer(possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)].value)
      }
      return
    }
    handleAnswer()
    history.push(linkTo)
  }, [answer, history, linkTo, handleAnswer, type])

  const renderTitle = (): React.ReactNode => {
    const headStyle: React.CSSProperties = {
      color,
      fontFamily: 'Fredoka One',
      fontSize: 21,
      fontWeight: 'normal',
      marginBottom: 25,
      marginTop: 60,
    }
    return <div style={{color: colors.WARM_GREY, fontSize: 19, textAlign: 'center'}}>
      <h1 style={headStyle}>{title}</h1>
    </div>
  }

  const renderBullet = (isDone: boolean): React.ReactNode => {
    return <div style={{
      backgroundColor: isDone ? color : colors.GREY,
      borderRadius: 25,
      height: isDone ? 25 : 15,
      margin: isDone ? '0 7px' : '0 12px',
      width: isDone ? 25 : 15,
    }} />
  }

  const renderLine = (isDone: boolean): React.ReactNode => {
    return <div style={{
      backgroundColor: isDone ? color : colors.GREY,
      borderRadius: 1.5,
      height: 3,
      width: (127 - 26) * (9 - numSteps) / 6 + 26,
    }} />
  }

  const renderProgress = (): React.ReactNode => {
    return <div style={{alignItems: 'center', display: 'flex'}}>
      {renderBullet(true)}
      {Array.from({length: numSteps - 1}, (unused, index: number): React.ReactNode =>
        <React.Fragment key={`step-${index}`}>
          {renderLine(index < numStepsDone)}
          {renderBullet(index < numStepsDone)}
        </React.Fragment>)}
    </div>
  }

  const renderButton = (): React.ReactNode => {
    if (answer === undefined) {
      return null
    }
    return <Button onClick={handleAnswer} to={linkTo}>
      {numStepsDone + 1 < numSteps ? 'suivant' : 'terminé'}
    </Button>
  }

  const getPropsForAnswer = (value: AnswerType, index: number):
  Pick<AnswerCardProps, 'isSelected'|'onBlur'|'onClick'|'onFocus'|'tabIndex'|'value'> & {
    ref?: React.RefObject<Focusable>
  } => ({
    isSelected: value === answer,
    onBlur: focusIndex === index ? clearFocus : undefined,
    onClick: setAnswer,
    onFocus: focusOnAnswer,
    ref: optionsRef.current?.[index],
    tabIndex: focused === index ? 0 : -1,
    value,
  })

  const renderConfidenceAnswers = (): React.ReactNode => {
    const joinImage = (src: string, text: string): React.ReactNode => <React.Fragment>
      <img src={src} alt="" style={{marginBottom: 10}} /><br />
      {text}
    </React.Fragment>
    const cardStyle = {
      padding: '25px 0 20px',
      width: 136,
    }
    return <React.Fragment>
      <AnswerCard
        answer={joinImage(notAtAllImage, getAnswerText('confidence', -2))} style={cardStyle}
        key="confidence--2" {...getPropsForAnswer(-2, 0)} />
      <AnswerCard
        answer={joinImage(notReallyImage, getAnswerText('confidence', -1))} style={cardStyle}
        key="confidence--1" {...getPropsForAnswer(-1, 1)} />
      <AnswerCard
        answer={joinImage(yesImage, getAnswerText('confidence', 1))} style={cardStyle}
        key="confidence-1" {...getPropsForAnswer(1, 2)} />
      <AnswerCard
        answer={joinImage(yesClearlyImage, getAnswerText('confidence', 2))} style={cardStyle}
        key="confidence-2" {...getPropsForAnswer(2, 3)} />
    </React.Fragment>
  }

  const renderLevelBar = (level: number & AnswerType): React.ReactNode => {
    const containerStyle: React.CSSProperties = {
      height: 117,
      marginBottom: 20,
      position: 'relative',
    }
    const barStyle: React.CSSProperties = {
      backgroundColor: levelColors[(level + '') as keyof typeof levelColors],
      borderRadius: 10,
      bottom: 0,
      height: 35 + (level + 2) * (117 - 35) / 4,
      left: 0,
      position: 'absolute',
      right: 0,
    }
    return <div style={containerStyle}>
      <div style={barStyle} aria-label={getAnswerText('levels', level)} />
    </div>
  }

  const renderLevelsAnswers = (): React.ReactNode => {
    const textStyle: React.CSSProperties = {
      color: colors.WARM_GREY,
      fontSize: 13,
      fontWeight: 'bold',
    }
    return <React.Fragment>
      <div style={textStyle}>{getAnswerText('levels', -2)}</div>
      {[-2, -1, 1, 2].map((level: number, index: number): React.ReactNode =>
        <AnswerCard
          key={level} answer={renderLevelBar(level as number & AnswerType)}
          {...getPropsForAnswer(level as number & AnswerType, index)} />)}
      <div style={textStyle}>{getAnswerText('levels', 2)}</div>
    </React.Fragment>
  }

  const renderYesNoLaterAnswers = (): React.ReactNode => {
    return <React.Fragment>
      {allPossibleAnswers[type].map(({name, value}, index) =>
        <AnswerCard
          answer={name} style={{minWidth: 168}} key={`${type}-${value}`}
          {...getPropsForAnswer(value, index)} />)}
    </React.Fragment>
  }

  const renderAnswers = (): React.ReactNode => {
    switch (type) {
      case 'confidence': return renderConfidenceAnswers()
      case 'levels': return renderLevelsAnswers()
      case 'yes/no': // Pass through intended.
      case 'yes/no/later': return renderYesNoLaterAnswers()
    }
    return null
  }

  const contentStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  }
  const questionStyle: React.CSSProperties = {
    color,
    fontFamily: 'Fredoka One',
    fontSize: 29,
    marginBottom: 50,
    maxWidth: 650,
    textAlign: 'center',
  }
  const answersStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
  }
  return <GenericPage hasLogo={true} bottomButton={renderButton()}>
    {renderTitle()}
    {renderProgress()}
    <div style={contentStyle}>
      <div style={questionStyle}>{question}</div>
      <div
        style={answersStyle} role="radiogroup" onKeyDown={handleKeyDown}
        tabIndex={-1} onFocus={handleFocus} ref={radiogroupRef}>
        {renderAnswers()}
      </div>
    </div>
  </GenericPage>
}


type MaybeQuestionPageProps = Partial<QuestionPageProps>


const MaybeQuestionPage: React.FC<MaybeQuestionPageProps> = (props: MaybeQuestionPageProps):
React.ReactElement => {
  const {linkTo, numSteps, numStepsDone, onAnswer, question, title, type, ...otherProps} = props
  if (question && linkTo && numSteps && onAnswer && title && type && numStepsDone !== undefined) {
    return <QuestionPage
      {...otherProps} {...{linkTo, numSteps, numStepsDone, onAnswer, question, title, type}} />
  }
  return <Redirect to={Routes.HUB_PAGE} />
}


export default React.memo(MaybeQuestionPage)

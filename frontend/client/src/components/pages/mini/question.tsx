import PropTypes from 'prop-types'
import React, {useCallback, useLayoutEffect, useState} from 'react'
import {Redirect, useHistory} from 'react-router-dom'

import {useFastForward} from 'components/fast_forward'
import notAtAllImage from 'images/mini/not-at-all.png'
import notReallyImage from 'images/mini/not-really.png'
import yesImage from 'images/mini/yes.png'
import yesClearlyImage from 'images/mini/yes-clearly.png'

import {GenericPage} from './page'
import {AnswerType, QuestionType} from './questions_tree'
import {Routes} from './store'
import {Button} from './theme'


const levelColors = {
  '-1': colors.MINI_BUDDHA_GOLD,
  '-2': colors.MINI_BROWN_YELLOW,
  '1': colors.MINI_SUPERNOVA,
  '2': colors.MINI_SUNFLOWER_YELLOW,
}


interface AnswerCardProps {
  answer?: React.ReactNode
  isSelected?: boolean
  onClick: (value: AnswerType) => void
  style?: React.CSSProperties
  value: AnswerType
}


// TODO(cyrille): Consider factorizing with HubCard.
const AnswerCardBase = (props: AnswerCardProps): React.ReactElement => {
  const [isHover, setIsHover] = useState(false)
  const handleMouseEnter = useCallback((): void => setIsHover(true), [])
  const handleMouseLeave = useCallback((): void => setIsHover(false), [])
  const {answer, isSelected, onClick, style, value} = props
  const handleClick = useCallback((): void => onClick(value), [onClick, value])

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 15,
    boxShadow: isHover ?
      '0px 10px 15px 0 rgba(0, 0, 0, 0.2)' :
      '0px 2px 5px 0 rgba(0, 0, 0, 0.2)',
    color: isSelected ? colors.MINI_SAP_GREEN : 'inherit',
    cursor: 'pointer',
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
    border: `solid 4px ${colors.MINI_PEA}`,
    borderRadius: cardStyle.borderRadius,
    bottom: 0,
    left: 0,
    opacity: (isHover || isSelected) ? 1 : 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: '450ms',
    zIndex: 1,
  }
  const outerCircleStyle: React.CSSProperties = {
    alignItems: 'center',
    border: `solid 1px ${isSelected ? colors.MINI_SAP_GREEN : colors.MINI_WARM_GREY}`,
    borderRadius: 10,
    display: 'flex',
    height: 20,
    justifyContent: 'center',
    margin: '10px auto 0',
    width: 20,
  }
  const innerCircleStyle = {
    backgroundColor: isSelected ? colors.MINI_PEA : 'transparent',
    borderRadius: 7,
    height: 14,
    width: 14,
  }
  return <div
    style={cardStyle} onMouseEnter={handleMouseEnter}
    onMouseLeave={handleMouseLeave} onClick={handleClick}>
    <div style={borderStyle} />
    {answer}
    <div style={outerCircleStyle}>
      <div style={innerCircleStyle} />
    </div>
  </div>
}
AnswerCardBase.propTypes = {
  answer: PropTypes.node,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  style: PropTypes.object,
}
const AnswerCard = React.memo(AnswerCardBase)


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


const QuestionPageBase = (props: QuestionPageProps): React.ReactElement => {
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

  // TODO(cyrille): Use the `to` parameter.
  useFastForward((): void => {
    if (answer === undefined) {
      let possibleAnswers: readonly AnswerType[]
      switch (type) {
        case 'confidence':
        case 'levels': // Fallthrough intended.
          possibleAnswers = [-2, -1, 1, 2]
          break
        case 'yes/no':
          possibleAnswers = [true, false]
          break
        case 'yes/no/later':
          possibleAnswers = [true, false, 'later']
          break
      }
      if (possibleAnswers) {
        setAnswer(possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)])
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
    return <div style={{color: colors.MINI_WARM_GREY, fontSize: 19, textAlign: 'center'}}>
      <h1 style={headStyle}>{title}</h1>
    </div>
  }

  const renderBullet = (isDone: boolean): React.ReactNode => {
    return <div style={{
      backgroundColor: isDone ? color : colors.MINI_GREY,
      borderRadius: 25,
      height: isDone ? 25 : 15,
      margin: isDone ? '0 7px' : '0 12px',
      width: isDone ? 25 : 15,
    }} />
  }

  const renderLine = (isDone: boolean): React.ReactNode => {
    return <div style={{
      backgroundColor: isDone ? color : colors.MINI_GREY,
      borderRadius: 1.5,
      height: 3,
      width: (127 - 26) * (9 - numSteps) / 6 + 26,
    }} />
  }

  const renderProgress = (): React.ReactNode => {
    return <div style={{alignItems: 'center', display: 'flex'}}>
      {renderBullet(true)}
      {new Array(numSteps - 1).fill(0).map((unused, index: number): React.ReactNode =>
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

  const renderYesNoAnswers = (): React.ReactNode => {
    return <React.Fragment>
      <AnswerCard
        answer="Oui" key="yes/no-yes" style={{minWidth: 168}} isSelected={answer === true}
        onClick={setAnswer} value={true} />
      <AnswerCard
        answer="Non" key="yes/no-no" style={{minWidth: 168}} isSelected={answer === false}
        onClick={setAnswer} value={false} />
    </React.Fragment>
  }

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
        answer={joinImage(notAtAllImage, 'Non pas du tout')} style={cardStyle} key="confidence--2"
        isSelected={answer === -2} onClick={setAnswer} value={-2} />
      <AnswerCard
        answer={joinImage(notReallyImage, 'Non pas vraiment')} style={cardStyle} key="confidence--1"
        isSelected={answer === -1} onClick={setAnswer} value={-1} />
      <AnswerCard
        answer={joinImage(yesImage, 'Oui plutôt')} style={cardStyle} key="confidence-1"
        isSelected={answer === 1} onClick={setAnswer} value={1} />
      <AnswerCard
        answer={joinImage(yesClearlyImage, 'Oui tout à fait')} style={cardStyle} key="confidence-2"
        isSelected={answer === 2} onClick={setAnswer} value={2} />
    </React.Fragment>
  }

  const renderLevelBar = (level: number): React.ReactNode => {
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
      <div style={barStyle} />
    </div>
  }

  const renderLevelsAnswers = (): React.ReactNode => {
    const textStyle: React.CSSProperties = {
      color: colors.MINI_WARM_GREY,
      fontSize: 13,
      fontWeight: 'bold',
    }
    return <React.Fragment>
      <div style={textStyle}>Non pas du tout</div>
      {[-2, -1, 1, 2].map((level: number): React.ReactNode => <AnswerCard
        key={level} answer={renderLevelBar(level)} isSelected={answer === level}
        onClick={setAnswer} value={level as AnswerType} />)}
      <div style={textStyle}>Oui tout à fait</div>
    </React.Fragment>
  }

  const renderYesNoLaterAnswers = (): React.ReactNode => {
    return <React.Fragment>
      <AnswerCard
        answer="Oui" style={{minWidth: 168}} isSelected={answer === true} key="ynl-yes"
        onClick={setAnswer} value={true} />
      <AnswerCard
        answer="Peut-être plus tard" style={{minWidth: 168}} isSelected={answer === 'later'}
        key="ynl-later" onClick={setAnswer} value="later" />
      <AnswerCard
        answer="Non" style={{minWidth: 168}} isSelected={answer === false} key="ynl-no"
        onClick={setAnswer} value={false} />
    </React.Fragment>
  }

  const renderAnswers = (): React.ReactNode => {
    switch (type) {
      case 'confidence': return renderConfidenceAnswers()
      case 'levels': return renderLevelsAnswers()
      case 'yes/no': return renderYesNoAnswers()
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
      <div style={answersStyle}>
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
    return <QuestionPageBase
      {...otherProps} {...{linkTo, numSteps, numStepsDone, onAnswer, question, title, type}} />
  }
  return <Redirect to={Routes.HUB_PAGE} />
}
const QuestionPage = React.memo(MaybeQuestionPage)


export {QuestionPage}

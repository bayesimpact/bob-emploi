import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'
import {Link, Redirect} from 'react-router-dom'

import {FastForward} from 'components/fast_forward'
import notAtAllImage from 'images/mini/not-at-all.png'
import notReallyImage from 'images/mini/not-really.png'
import yesImage from 'images/mini/yes.png'
import yesClearlyImage from 'images/mini/yes-clearly.png'

import {GenericPage} from './page'
import {AnswerType, QuestionType} from './questions_tree'


const levelColors = {
  '-1': colors.MINI_BUDDHA_GOLD,
  '-2': colors.MINI_BROWN_YELLOW,
  '1': colors.MINI_SUPERNOVA,
  '2': colors.MINI_SUNFLOWER_YELLOW,
}


interface AnswerCardProps {
  answer?: React.ReactNode
  isSelected?: boolean
  onClick: () => void
  style?: React.CSSProperties
}


// TODO(cyrille): Consider factorizing with HubCard.
class AnswerCard extends React.PureComponent<AnswerCardProps, {isHover: boolean}> {
  public static propTypes = {
    answer: PropTypes.node,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
  }

  public state = {isHover: false}

  private handleMouseEnter = (): void => this.setState({isHover: true})

  private handleMouseLeave = (): void => this.setState({isHover: false})

  public render(): React.ReactNode {
    const {answer, isSelected, onClick, style} = this.props
    const {isHover} = this.state
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
      style={cardStyle} onMouseEnter={this.handleMouseEnter}
      onMouseLeave={this.handleMouseLeave} onClick={onClick}>
      <div style={borderStyle} />
      {answer}
      <div style={outerCircleStyle}>
        <div style={innerCircleStyle} />
      </div>
    </div>
  }
}


interface QuestionPageProps {
  answer: AnswerType
  color: string
  linkTo: string
  numSteps: number
  numStepsDone: number
  onAnswer: (answer: AnswerType) => void
  question: React.ReactNode
  title: React.ReactNode
  type: QuestionType
}


interface QuestionPageState {
  answer?: AnswerType
  isFastForwarded?: boolean
  question: React.ReactNode
}


class QuestionPage extends React.PureComponent<QuestionPageProps, QuestionPageState> {
  public static getDerivedStateFromProps(
    {answer, question}: QuestionPageProps, {question: lastQuestion}): QuestionPageState {
    if (question === lastQuestion) {
      return null
    }
    return {answer, isFastForwarded: false, question}
  }

  public state: QuestionPageState = {question: null}

  private fastForward = (): void => {
    const {type} = this.props
    const {answer} = this.state
    if (answer === undefined) {
      let possibleAnswers
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
        this.setState({answer: possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)]})
      }
      return
    }
    this.handleAnswer()
    this.setState({isFastForwarded: true})
  }

  private handleSetAnswer = _memoize((answer): (() => void) => (): void => this.setState({answer}))

  private handleAnswer = (): void => this.props.onAnswer && this.props.onAnswer(this.state.answer)

  private renderTitle(): React.ReactNode {
    const {color, title} = this.props
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

  private renderBullet(isDone: boolean): React.ReactNode {
    return <div style={{
      backgroundColor: isDone ? this.props.color : colors.MINI_GREY,
      borderRadius: 25,
      height: isDone ? 25 : 15,
      margin: isDone ? '0 7px' : '0 12px',
      width: isDone ? 25 : 15,
    }} />
  }

  private renderLine(isDone: boolean): React.ReactNode {
    const {numSteps} = this.props
    return <div style={{
      backgroundColor: isDone ? this.props.color : colors.MINI_GREY,
      borderRadius: 1.5,
      height: 3,
      width: (127 - 26) * (9 - numSteps) / 6 + 26,
    }} />
  }

  private renderProgress(): React.ReactNode {
    const {numSteps, numStepsDone} = this.props
    return <div style={{alignItems: 'center', display: 'flex'}}>
      {this.renderBullet(true)}
      {new Array(numSteps - 1).fill(0).map((unused, index: number): React.ReactNode =>
        <React.Fragment key={`step-${index}`}>
          {this.renderLine(index < numStepsDone)}
          {this.renderBullet(index < numStepsDone)}
        </React.Fragment>)}
    </div>
  }

  private renderButton(): React.ReactNode {
    const {linkTo, numSteps, numStepsDone} = this.props
    const {answer, isFastForwarded} = this.state
    if (answer === undefined) {
      return null
    }
    const buttonStyle = {
      backgroundColor: colors.MINI_PEA,
      borderRadius: 15,
      boxShadow: '0px 10px 15px 0 rgba(0, 0, 0, 0.2)',
      color: colors.MINI_WHITE,
      cursor: 'pointer',
      fontFamily: 'Fredoka One',
      fontSize: 21,
      padding: '15px 70px',
      textDecoration: 'none',
    }
    if (isFastForwarded) {
      return <Redirect to={linkTo} push={true} />
    }
    return <Link
      style={buttonStyle} onClick={this.handleAnswer} to={linkTo}>
      {numStepsDone + 1 < numSteps ? 'suivant' : 'terminé'}
    </Link>
  }

  private renderYesNoAnswers(answer): React.ReactNode {
    return <React.Fragment>
      <AnswerCard
        answer="Oui" key="yes/no-yes" style={{minWidth: 168}} isSelected={answer === true}
        onClick={this.handleSetAnswer(true)} />
      <AnswerCard
        answer="Non" key="yes/no-no" style={{minWidth: 168}} isSelected={answer === false}
        onClick={this.handleSetAnswer(false)} />
    </React.Fragment>
  }

  private renderConfidenceAnswers(answer): React.ReactNode {
    const joinImage = (src, text): React.ReactNode => <React.Fragment>
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
        isSelected={answer === -2} onClick={this.handleSetAnswer(-2)} />
      <AnswerCard
        answer={joinImage(notReallyImage, 'Non pas vraiment')} style={cardStyle} key="confidence--1"
        isSelected={answer === -1} onClick={this.handleSetAnswer(-1)} />
      <AnswerCard
        answer={joinImage(yesImage, 'Oui plutôt')} style={cardStyle} key="confidence-1"
        isSelected={answer === 1} onClick={this.handleSetAnswer(1)} />
      <AnswerCard
        answer={joinImage(yesClearlyImage, 'Oui tout à fait')} style={cardStyle} key="confidence-2"
        isSelected={answer === 2} onClick={this.handleSetAnswer(2)} />
    </React.Fragment>
  }

  private renderLevelBar(level: number): React.ReactNode {
    const containerStyle: React.CSSProperties = {
      height: 117,
      marginBottom: 20,
      position: 'relative',
    }
    const barStyle: React.CSSProperties = {
      backgroundColor: levelColors[level],
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

  private renderLevelsAnswers(answer): React.ReactNode {
    const textStyle: React.CSSProperties = {
      color: colors.MINI_WARM_GREY,
      fontSize: 13,
      fontWeight: 'bold',
    }
    return <React.Fragment>
      <div style={textStyle}>Non pas du tout</div>
      {[-2, -1, 1, 2].map((level: number): React.ReactNode => <AnswerCard
        key={level} answer={this.renderLevelBar(level)} isSelected={answer === level}
        onClick={this.handleSetAnswer(level)} />)}
      <div style={textStyle}>Oui tout à fait</div>
    </React.Fragment>
  }

  private renderYesNoLaterAnswers(answer): React.ReactNode {
    return <React.Fragment>
      <AnswerCard
        answer="Oui" style={{minWidth: 168}} isSelected={answer === true} key="ynl-yes"
        onClick={this.handleSetAnswer(true)} />
      <AnswerCard
        answer="Peut-être plus tard" style={{minWidth: 168}} isSelected={answer === 'later'}
        key="ynl-later" onClick={this.handleSetAnswer('later')} />
      <AnswerCard
        answer="Non" style={{minWidth: 168}} isSelected={answer === false} key="ynl-no"
        onClick={this.handleSetAnswer(false)} />
    </React.Fragment>
  }

  private renderAnswers(answer): React.ReactNode {
    const {type} = this.props
    switch (type) {
      case 'confidence': return this.renderConfidenceAnswers(answer)
      case 'levels': return this.renderLevelsAnswers(answer)
      case 'yes/no': return this.renderYesNoAnswers(answer)
      case 'yes/no/later': return this.renderYesNoLaterAnswers(answer)
    }
    return null
  }

  public render(): React.ReactNode {
    const {answer, question} = this.state
    if (!question) {
      return <Redirect to="/mini" />
    }
    const {color} = this.props
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
    return <GenericPage bottomButton={this.renderButton()}>
      <FastForward onForward={this.fastForward} />
      {this.renderTitle()}
      {this.renderProgress()}
      <div style={contentStyle}>
        <div style={questionStyle}>{question}</div>
        <div style={answersStyle}>
          {this.renderAnswers(answer)}
        </div>
      </div>
    </GenericPage>
  }
}


export {QuestionPage}

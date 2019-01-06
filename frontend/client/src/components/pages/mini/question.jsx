import PropTypes from 'prop-types'
import React from 'react'
import {Link, Redirect} from 'react-router-dom'

import {FastForward} from 'components/fast_forward'
import notAtAllImage from 'images/mini/not-at-all.png'
import notReallyImage from 'images/mini/not-really.png'
import yesImage from 'images/mini/yes.png'
import yesClearlyImage from 'images/mini/yes-clearly.png'

import {GenericPage} from './page'


const levelColors = {
  '-1': colors.MINI_BUDDHA_GOLD,
  '-2': colors.MINI_BROWN_YELLOW,
  '1': colors.MINI_SUPERNOVA,
  '2': colors.MINI_SUNFLOWER_YELLOW,
}


// TODO(cyrille): Consider factorizing with HubCard.
class AnswerCard extends React.Component {
  static propTypes = {
    answer: PropTypes.node,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
  }

  state = {isHover: false}

  handleMouseEnter = () => this.setState({isHover: true})

  handleMouseLeave = () => this.setState({isHover: false})

  render() {
    const {answer, isSelected, onClick, style} = this.props
    const {isHover} = this.state
    const cardStyle = {
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
    const borderStyle = {
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
    const outerCircleStyle = {
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


class QuestionPage extends React.Component {
  static propTypes = {
    answer: PropTypes.any,
    color: PropTypes.string.isRequired,
    linkTo: PropTypes.string.isRequired,
    numSteps: PropTypes.number.isRequired,
    numStepsDone: PropTypes.number.isRequired,
    onAnswer: PropTypes.func,
    question: PropTypes.node.isRequired,
    title: PropTypes.node.isRequired,
    type: PropTypes.oneOf(['yes/no', 'yes/no/later', 'confidence', 'levels']).isRequired,
  }

  state = {answer: this.props.answer}

  fastForward = () => {
    const {onAnswer, type} = this.props
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
    onAnswer && onAnswer(answer)
    this.setState({isFastForwarded: true})
  }

  renderTitle() {
    const {color, title} = this.props
    const headStyle = {
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

  renderBullet(isDone) {
    return <div style={{
      backgroundColor: isDone ? this.props.color : '#ccc',
      borderRadius: 25,
      height: isDone ? 25 : 15,
      margin: isDone ? '0 7px' : '0 12px',
      width: isDone ? 25 : 15,
    }} />
  }

  renderLine(isDone) {
    const {numSteps} = this.props
    return <div style={{
      backgroundColor: isDone ? this.props.color : '#ccc',
      borderRadius: 1.5,
      height: 3,
      width: (127 - 26) * (9 - numSteps) / 6 + 26,
    }} />
  }

  renderProgress() {
    const {numSteps, numStepsDone} = this.props
    return <div style={{alignItems: 'center', display: 'flex'}}>
      {this.renderBullet(true)}
      {new Array(numSteps - 1).fill().map((unused, index) => <React.Fragment key={`step-${index}`}>
        {this.renderLine(index < numStepsDone)}
        {this.renderBullet(index < numStepsDone)}
      </React.Fragment>)}
    </div>
  }

  renderButton() {
    const {linkTo, numSteps, numStepsDone, onAnswer} = this.props
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
      style={buttonStyle} onClick={() => onAnswer && onAnswer(answer)} to={linkTo}>
      {numStepsDone + 1 < numSteps ? 'suivant' : 'terminé'}
    </Link>
  }

  renderYesNoAnswers(answer) {
    return <React.Fragment>
      <AnswerCard
        answer="Oui" style={{minWidth: 168}} isSelected={answer === true}
        onClick={() => this.setState({answer: true})} />
      <AnswerCard
        answer="Non" style={{minWidth: 168}} isSelected={answer === false}
        onClick={() => this.setState({answer: false})} />
    </React.Fragment>
  }

  renderConfidenceAnswers(answer) {
    const joinImage = (src, text) => <React.Fragment>
      <img src={src} alt="" style={{marginBottom: 10}} /><br />
      {text}
    </React.Fragment>
    const cardStyle = {
      padding: '25px 0 20px',
      width: 136,
    }
    return <React.Fragment>
      <AnswerCard
        answer={joinImage(notAtAllImage, 'Non pas du tout')} style={cardStyle}
        isSelected={answer === -2} onClick={() => this.setState({answer: -2})} />
      <AnswerCard
        answer={joinImage(notReallyImage, 'Non pas vraiment')} style={cardStyle}
        isSelected={answer === -1} onClick={() => this.setState({answer: -1})} />
      <AnswerCard
        answer={joinImage(yesImage, 'Oui plutôt')} style={cardStyle}
        isSelected={answer === 1} onClick={() => this.setState({answer: 1})} />
      <AnswerCard
        answer={joinImage(yesClearlyImage, 'Oui tout à fait')} style={cardStyle}
        isSelected={answer === 2} onClick={() => this.setState({answer: 2})} />
    </React.Fragment>
  }

  renderLevelBar(level) {
    const containerStyle = {
      height: 117,
      marginBottom: 20,
      position: 'relative',
    }
    const barStyle = {
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

  renderLevelsAnswers(answer) {
    const textStyle = {
      color: colors.MINI_WARM_GREY,
      fontSize: 13,
      fontWeight: 'bold',
    }
    return <React.Fragment>
      <div style={textStyle}>Non pas du tout</div>
      {[-2, -1, 1, 2].map(level => <AnswerCard
        key={level} answer={this.renderLevelBar(level)} isSelected={answer === level}
        onClick={() => this.setState({answer: level})} />)}
      <div style={textStyle}>Oui tout à fait</div>
    </React.Fragment>
  }

  renderYesNoLaterAnswers(answer) {
    return <React.Fragment>
      <AnswerCard
        answer="Oui" style={{minWidth: 168}} isSelected={answer === true}
        onClick={() => this.setState({answer: true})} />
      <AnswerCard
        answer="Peut-être plus tard" style={{minWidth: 168}} isSelected={answer === 'later'}
        onClick={() => this.setState({answer: 'later'})} />
      <AnswerCard
        answer="Non" style={{minWidth: 168}} isSelected={answer === false}
        onClick={() => this.setState({answer: false})} />
    </React.Fragment>
  }

  renderAnswers(answer) {
    const {type} = this.props
    switch (type) {
      case 'confidence': return this.renderConfidenceAnswers(answer)
      case 'levels': return this.renderLevelsAnswers(answer)
      case 'yes/no': return this.renderYesNoAnswers(answer)
      case 'yes/no/later': return this.renderYesNoLaterAnswers(answer)
    }
    return null
  }

  render() {
    const {color, question} = this.props
    const {answer} = this.state
    const contentStyle = {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
    }
    const questionStyle = {
      color,
      fontFamily: 'Fredoka One',
      fontSize: 29,
      marginBottom: 50,
      maxWidth: 650,
      textAlign: 'center',
    }
    const answersStyle = {
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

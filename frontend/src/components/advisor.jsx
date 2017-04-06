import React from 'react'
import {connect} from 'react-redux'
import Radium from 'radium'

import {scoreAdvice} from 'store/actions'
import {priorityTitle} from 'store/advice'
import {hasUserEverAcceptedAdvice} from 'store/project'

import {Colors, FastTransitions, SmoothTransitions, Styles} from 'components/theme'

import FreshResume from './advisor/fresh_resume'
import ImproveInterview from './advisor/improve_interview'
import ImproveResume from './advisor/improve_resume'
import LifeBalance from './advisor/life_balance'
import NetworkApplication from './advisor/network_bad'
import NetworkApplicationMedium from './advisor/network_medium'
import NetworkApplicationGood from './advisor/network_good'
import OtherWorkEnv from './advisor/other_work_env'
import SpontaneousApplication from './advisor/spontaneous'


// Map of advice recommendation modules keyed by advice module IDs.
const ADVICE_MODULES = {
  'fresh-resume': FreshResume,
  'improve-interview': ImproveInterview,
  'improve-resume': ImproveResume,
  'life-balance': LifeBalance,
  'network-application': NetworkApplication,
  'network-application-good': NetworkApplicationGood,
  'network-application-medium': NetworkApplicationMedium,
  'other-work-env': OtherWorkEnv,
  'spontaneous-application': SpontaneousApplication,
}


class AdviceCardBase extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
    dispatch: React.PropTypes.func.isRequired,
    isInAdvicePage: React.PropTypes.bool,
    onScoreAdvice: React.PropTypes.func,
    priority: React.PropTypes.number.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  componentWillMount() {
    this.setState({
      isJustMounted: true,
      isVisible: false,
    })
    this.timeout = setTimeout(() => this.setState({isJustMounted: false}), 100)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  setScore = score => {
    const {advice, dispatch, onScoreAdvice, project} = this.props
    dispatch(scoreAdvice(project, advice, score))
    onScoreAdvice && onScoreAdvice(score)
  }

  renderLeftCard(style) {
    const {advice, isInAdvicePage, priority} = this.props
    if (isInAdvicePage) {
      return null
    }
    const {isMobileVersion} = this.context
    const numStars = advice.numStars || 1
    const backgroundColor = numStars < 2 ? Colors.SILVER :
        numStars >= 3 ? Colors.RED_PINK : Colors.SQUASH
    const containerStyle = {
      backgroundColor,
      borderRadius: isMobileVersion ? '4px 4px 0 0' : 4,
      color: '#fff',
      fontSize: 17,
      fontStyle: 'italic',
      fontWeight: 'bold',
      padding: 15,
      textAlign: 'center',
      textTransform: 'uppercase',
      ...style,
    }
    // TODO(guillaume) Put a gradient when we know for sure that it is what is decided.
    // TODO(guillaume) Put a vertical line below the bubble.
    // TODO(pascal): Use the style given in argument.
    if (!isInAdvicePage && !isMobileVersion) {
      const bubbleStyle = {
        backgroundColor,
        borderRadius: 66.7,
        color: '#fff',
        display: 'inline-block',
        fontSize: 17,
        fontStyle: 'italic',
        fontWeight: 'bold',
        height: 40,
        left: 20,
        padding: 7,
        position: 'absolute',
        textAlign: 'center',
        top: 38,
        width: 40,
      }
      return <header style={bubbleStyle}>
        <div style={Styles.CENTER_ITALIC_FONT}>{priority}</div>
      </header>
    }
    return <header style={containerStyle}>
      {priorityTitle(advice, priority)}
    </header>
  }

  handleSelectScore = event => {
    if (event.target.value) {
      this.setScore(parseInt(event.target.value, 10))
    }
  }

  renderMobileScoreBar() {
    const {advice} = this.props
    const {score, isInAdvicePage} = advice
    if (isInAdvicePage) {
      return null
    }
    return <div style={{marginTop: 25}}>
      <label>
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          Ce sujet vous semble-t-il prioritaire&nbsp;?
          <select value={score} onChange={this.handleSelectScore}>
            {score ? null : <option></option>}
            <option value={10}>&nbsp;10 très prioritaire</option>
            {new Array(8).fill(1).map((unused, index) => <option
                value={9 - index} key={index}> &nbsp;{9 - index}
            </option>)}
            <option value={1}>&nbsp;1 peu prioritaire</option>
          </select>
        </div>
      </label>
    </div>
  }

  renderScoreBar() {
    const {advice, isInAdvicePage} = this.props
    if (isInAdvicePage) {
      return null
    }
    const {score} = advice
    const isCardShown = this.isCardShown()
    const style = {
      alignItems: 'center',
      color: Colors.DARK_TWO,
      display: 'flex',
      fontSize: 13,
      opacity: isCardShown ? 1 : 0,
      overflow: 'hidden',
      padding: '17px 70px 0 30px',
      transform: `translateY(${isCardShown ? '0' : '-100%'})`,
      transition: 'all 300ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 300ms',
    }
    const scoreStyle = {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      fontWeight: 'bold',
    }
    return <div style={style}>
      <div style={{flex: 1}}>
        Ce sujet vous semble-t-il prioritaire&nbsp;?
      </div>
      <div style={scoreStyle}>
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Peu prioritaire
        </span>
        {new Array(10).fill(undefined).map((unused, index) => <ScoreButton
            key={index + 1} onClick={() => this.setScore(index + 1)}
            isSelected={index + 1 === score}>
          {index + 1}
        </ScoreButton>)}
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Très prioritaire
        </span>
      </div>
    </div>
  }

  isCardShown() {
    const {isInAdvicePage, project} = this.props
    const {isJustMounted, isVisible} = this.state
    return isInAdvicePage || hasUserEverAcceptedAdvice(project) || isVisible && !isJustMounted
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {advice, dispatch, isInAdvicePage, project, style, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const isCardShown = this.isCardShown()
    const module = ADVICE_MODULES[advice.adviceId] || null
    const CardComponent = module && module.FullAdviceCard || null
    if (!CardComponent) {
      return null
    }
    const containerStyle = {
      maxWidth: '100%',
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }
    const cardStyle = {
      flex: 1,
      marginBottom: isInAdvicePage ? 50 : 0,
      marginLeft: (isMobileVersion || isInAdvicePage) ? 0 : 80,
      marginTop: isMobileVersion ? 0 : isInAdvicePage ? 30 : 0,
      opacity: isCardShown ? 1 : 0,
      transform: `translateX(${isCardShown ? '0' : '50%'})`,
      ...FastTransitions,
    }
    const leftCardStyle = isMobileVersion ? {} : {
      position: 'absolute',
      right: isInAdvicePage ? 30 : 'initial',
      width: 190,
      zIndex: isInAdvicePage ? 1 : 'initial',
    }

    return <div style={containerStyle}>
      {this.renderLeftCard(leftCardStyle)}
      <div style={cardStyle}>
        <CardComponent
            {...extraProps} advice={advice} project={project}
            isInAdvicePage={isInAdvicePage} onShow={() => this.setState({isVisible: true})} />
        {isMobileVersion ? this.renderMobileScoreBar() : this.renderScoreBar()}
      </div>
    </div>
  }
}
const AdviceCard = connect()(AdviceCardBase)


class ScoreButtonBase extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    isSelected: React.PropTypes.bool,
    onClick: React.PropTypes.func,
  }

  render() {
    const {children, isSelected, onClick, ...extraProps} = this.props
    const buttonStyle = {
      ':hover': isSelected ? {} : {border: `solid 1px ${Colors.GREYISH_BROWN}`},
      alignItems: 'center',
      backgroundColor: isSelected ? Colors.SKY_BLUE : 'initial',
      border: `solid 1px ${isSelected ? Colors.SKY_BLUE : Colors.PINKISH_GREY}`,
      borderRadius: 100,
      color: isSelected ? '#fff' : Colors.DARK_TWO,
      cursor: isSelected ? 'initial' : 'pointer',
      display: 'flex',
      height: 25,
      justifyContent: 'center',
      margin: 5,
      width: 25,
      ...(isSelected ? null : SmoothTransitions),
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <span {...extraProps} style={buttonStyle} onClick={isSelected ? null : onClick}>
      {children}
    </span>
  }
}
const ScoreButton = Radium(ScoreButtonBase)


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
  }

  renderGeneric(style, extraProps) {
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      ...style,
    }
    return <div style={containerStyle} {...extraProps}>
      <div style={{flex: 1, textAlign: 'center'}}>
        <img src={require('images/construction-picto.svg')} />
        <div style={{fontStyle: 'italic', fontWeight: 500}}>
          Module en construction
        </div>
      </div>

      <div style={{flex: 2}}>
        <p>
          Vous serez notifié lorsque le module sera prêt pour vous aider à
          avancer sur ce sujet.
        </p>
      </div>
    </div>
  }

  render() {
    const {advice, style, ...extraProps} = this.props
    const module = ADVICE_MODULES[advice.adviceId] || null
    const PageComponent = module && module.AdvicePageContent || null
    if (PageComponent) {
      return <PageComponent {...this.props} />
    }
    return this.renderGeneric(style, extraProps)
  }
}


export {AdviceCard, AdvicePageContent}

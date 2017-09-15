import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import {adviceCardIsShown, advicePageIsShown, getAdviceTips, scoreAdvice, selectAdvice,
  seeAdvice, sendAdviceFeedback} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {hasUserEverAcceptedAdvice} from 'store/project'

import constructionImage from 'images/construction-picto.svg'
import starIcon from 'images/star.svg'
import starOutlineIcon from 'images/star-outline.svg'
import {Modal, ModalCloseButton} from 'components/modal'
import {Button, Colors, FastTransitions, SmoothTransitions, Styles, Tag} from 'components/theme'
import {TipsList} from 'components/tips'

import adviceModuleProperties from './advisor/data/advice_modules.json'

import AssociationHelp from './advisor/association_help'
import BetterJobInGroup from './advisor/better_job_in_group'
import Commute from './advisor/commute'
import Events from './advisor/events'
import FromServer from './advisor/from_server'
import ImproveInterview from './advisor/improve_interview'
import ImproveResume from './advisor/improve_resume'
import JobBoards from './advisor/job_boards'
import LessApplications from './advisor/less_applications'
import LifeBalance from './advisor/life_balance'
import MotivationEmail from './advisor/motivation_email'
import NetworkApplication from './advisor/network_bad'
import NetworkApplicationMedium from './advisor/network_medium'
import NetworkApplicationGood from './advisor/network_good'
import OtherWorkEnv from './advisor/other_work_env'
import Relocate from './advisor/relocate'
import SeasonalRelocate from './advisor/seasonal_relocate'
import Senior from './advisor/senior'
import SpontaneousApplication from './advisor/spontaneous'
import Training from './advisor/training'
import Volunteer from './advisor/volunteer'
import Vae from './advisor/vae'
import WowBaker from './advisor/wow_baker'
import WowHairdresser from './advisor/wow_hairdresser'


// Map of advice recommendation modules keyed by advice module IDs.
const ADVICE_MODULES = {
  'association-help': AssociationHelp,
  'better-job-in-group': BetterJobInGroup,
  'commute': Commute,
  'events': Events,
  'find-a-jobboard': JobBoards,
  'fresh-resume': ImproveResume,
  'improve-interview': ImproveInterview,
  'improve-resume': ImproveResume,
  'less-applications': LessApplications,
  'life-balance': LifeBalance,
  'motivation-email': MotivationEmail,
  'network-application': NetworkApplication,
  'network-application-good': NetworkApplicationGood,
  'network-application-medium': NetworkApplicationMedium,
  'other-work-env': OtherWorkEnv,
  'relocate': Relocate,
  'seasonal-relocate': SeasonalRelocate,
  'senior': Senior,
  'specific-to-job': FromServer,
  'spontaneous-application': SpontaneousApplication,
  'training': Training,
  'vae': Vae,
  'volunteer': Volunteer,
  'wow-baker': WowBaker,
  'wow-hairdresser': WowHairdresser,
}


class WhiteAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    children: PropTypes.node,
    dispatch: PropTypes.func.isRequired,
    onExpandChanged: PropTypes.func,
    onHoverChanged: PropTypes.func,
    onShow: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  state = {
    hasBeenSeen: false,
    isExpanded: false,
    isHovered: false,
  }

  componentWillMount() {
    const {advice, dispatch, project} = this.props
    dispatch(adviceCardIsShown(project, advice))
  }

  changeExpand = isExpanded => {
    const {onExpandChanged} = this.props
    this.setState({isExpanded})
    onExpandChanged && onExpandChanged(isExpanded)
  }

  changeHover = isHovered => {
    const {onHoverChanged} = this.props
    this.setState({isHovered})
    onHoverChanged && onHoverChanged(isHovered)
  }

  gotoAdvicePage = visualElement => event => {
    const {advice, dispatch, project} = this.props
    event.stopPropagation()
    this.changeExpand(true)
    dispatch(selectAdvice(project, advice, visualElement))
    dispatch(getAdviceTips(project, advice))
    dispatch(advicePageIsShown(project, advice))
  }

  handleVisibilityChange = isVisible => {
    if (!isVisible) {
      return
    }
    const {advice, dispatch, onShow, project} = this.props
    this.setState({hasBeenSeen: true})
    dispatch(seeAdvice(project, advice))
    onShow && onShow()
  }

  collapse = () => {
    this.changeExpand(false)
  }

  handleStarClick = event => {
    const {advice, dispatch, project} = this.props
    event.stopPropagation()
    const newScore = advice.score ? 0 : 10
    dispatch(scoreAdvice(project, advice, newScore))
  }

  renderTitle() {
    const {advice} = this.props
    const {isExpanded} = this.state
    const isAdviceUnread = advice.status === 'ADVICE_RECOMMENDED'
    const style = {
      alignItems: 'center',
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: (!isExpanded && isAdviceUnread) ? 'bold' : 500,
    }
    const tagStyle = {
      backgroundColor: Colors.GREENISH_TEAL,
      marginLeft: 20,
    }
    const starStyle = {
      cursor: 'pointer',
      width: 20,
    }
    const closeButtonStyle = {
      ':hover': {
        opacity: .6,
      },
      boxShadow: 'initial',
      opacity: .3,
      position: 'initial',
      transform: 'initial',
      zIndex: 'initial',
    }
    return <header style={style}>
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        {getAdviceTitle(advice)}
      </span>
      <div className="tooltip" style={{alignItems: 'center', display: 'flex', marginLeft: 15}}>
        <img
          src={advice.score ? starIcon : starOutlineIcon}
          style={starStyle} onClick={this.handleStarClick} alt="Très bon conseil" />
        <div
          className="tooltiptext tooltip-bottom"
          style={{fontSize: 13, fontWeight: 'initial', padding: '10px 13px', width: 160}}>
          Ce conseil m'est utile
        </div>
      </div>
      {(isExpanded || !isAdviceUnread) ? null : <Tag style={tagStyle}>Nouveau</Tag>}
      <span style={{flex: 1}} />
      {this.state.isExpanded ? <ModalCloseButton
        onClick={this.collapse} style={closeButtonStyle} /> : null}
    </header>
  }

  renderExpandButtonBar(style) {
    const {advice} = this.props
    const {isHovered} = this.state
    const {callToAction} = adviceModuleProperties[advice.adviceId] || {}
    const plusStyle = {
      backgroundColor: isHovered ? Colors.SKY_BLUE : 'transparent',
      border: `solid 1px ${isHovered ? Colors.SKY_BLUE : Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 25,
      color: isHovered ? '#fff' : Colors.CHARCOAL_GREY,
      display: 'inline-block',
      height: 25,
      lineHeight: '25px',
      marginRight: 15,
      textAlign: 'center',
      verticalAlign: 'middle',
      width: 25,
      ...SmoothTransitions,
    }
    return <div style={{alignItems: 'center', display: 'flex', ...style}}>
      <span style={plusStyle}>+</span>
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        {callToAction || 'Voir plus'}
      </span>
    </div>
  }

  render() {
    const {advice, children, project, style} = this.props
    const {isExpanded} = this.state
    const cardStyle = {
      backgroundColor: '#fff',
      boxShadow:
        isExpanded ? '0 2px 14px 0 rgba(0, 0, 0, 0.15)' : '0 2px 20px 0 rgba(0, 0, 0, 0.2)',
      color: Colors.CHARCOAL_GREY,
      cursor: isExpanded ? 'initial' : 'pointer',
      ...SmoothTransitions,
      ...style,
    }
    const headerStyle = {
      borderBottom: isExpanded ? `solid 1px ${Colors.MODAL_PROJECT_GREY}` : 'initial',
      padding: '35px 40px',
    }
    const contentStyle = {
      backgroundColor: isExpanded ? Colors.LIGHT_GREY : 'transparent',
      padding: isExpanded ? 40 : '0 40px 40px',
      ...SmoothTransitions,
    }
    return <VisibilitySensor
      active={!this.state.hasBeenSeen} intervalDelay={250} minTopValue={10}
      partialVisibility={true} onChange={this.handleVisibilityChange}>
      <section
        style={cardStyle}
        onClick={isExpanded ? null : this.gotoAdvicePage('advice-card')}
        onMouseEnter={() => this.changeHover(true)}
        onMouseLeave={() => this.changeHover(false)}>
        <header style={headerStyle}>
          {this.renderTitle()}
        </header>
        {isExpanded ? <div style={contentStyle}>
          <ExpandedAdviceCardContent {...this.props} />
          <TipsList project={project} advice={advice} />
          <div style={{alignItems: 'center', display: 'flex', fontSize: 13, marginTop: 30}}>
            Vous avez d'autres exemples à partager ?
            <FeedbackButton advice={advice} project={project}>
              Proposer une idée
            </FeedbackButton>
          </div>
        </div> : <div style={contentStyle}>
          {children}
          {this.renderExpandButtonBar({marginTop: 40})}
        </div>}
      </section>
    </VisibilitySensor>
  }
}


class AdviceCardBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    maxWidth: PropTypes.number,
    project: PropTypes.object.isRequired,
    refDom: PropTypes.func,
    style: PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    this.setState({
      isExpanded: false,
      isJustMounted: true,
      isVisible: false,
    })
    this.timeout = setTimeout(() => this.setState({isJustMounted: false}), 100)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  isCardShown() {
    const {project} = this.props
    const {isJustMounted, isVisible} = this.state
    return hasUserEverAcceptedAdvice(project) || isVisible && !isJustMounted
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {advice, dispatch, maxWidth, project, refDom, style, ...extraProps} = this.props
    const {isExpanded} = this.state
    const isCardShown = this.isCardShown()
    const module = ADVICE_MODULES[advice.adviceId] || null
    const CardComponent = module && module.AdviceCard || null
    if (!CardComponent) {
      return null
    }
    const containerStyle = {
      maxWidth: '100%',
      overflow: 'hidden',
      ...style,
    }
    const cardStyle = {
      opacity: isCardShown ? 1 : 0,
      transform: isExpanded ? 'initial' : `translateY(${isCardShown ? '0' : '50%'})`,
      ...FastTransitions,
    }
    return <div style={containerStyle} ref={refDom} id={advice.adviceId}>
      <div style={{margin: 'auto', maxWidth}}>
        <div style={cardStyle}>
          <WhiteAdviceCard
            {...extraProps} advice={advice} dispatch={dispatch} project={project}
            onShow={() => this.setState({isVisible: true})}
            onExpandChanged={isExpanded => this.setState({isExpanded})}>
            <CardComponent {...extraProps} advice={advice} project={project} />
          </WhiteAdviceCard>
        </div>
      </div>
    </div>
  }
}
const AdviceCard = connect(({app}, {advice, project}) => ({
  tips: (app.adviceTips[project.projectId] || {})[advice.adviceId] || [],
}))(AdviceCardBase)


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  renderGeneric(style) {
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      ...style,
    }
    return <div style={containerStyle}>
      <div style={{flex: 1, textAlign: 'center'}}>
        <img src={constructionImage} alt="" />
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
    const {advice, style} = this.props
    const module = ADVICE_MODULES[advice.adviceId] || null
    const PageComponent = module && module.ExpandedAdviceCardContent || null
    if (PageComponent) {
      return <PageComponent {...this.props} />
    }
    return this.renderGeneric(style)
  }
}


class FeedbackButtonBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    children: PropTypes.node.isRequired,
    dispatch: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  state = {
    isFeedbackModalShown: false,
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.isFeedbackModalShown && !prevState.isFeedbackModalShown) {
      this.feedbackDom && this.feedbackDom.focus()
    }
  }

  sendFeedback = () => {
    const {advice, dispatch, project} = this.props
    const feedback = this.feedbackDom && this.feedbackDom.value
    dispatch(sendAdviceFeedback(project, advice, feedback))
    this.setState({isFeedbackModalShown: false})
  }

  render() {
    const {children, style} = this.props
    const {hasFeedback} = this.state
    const buttonStyle = {
      ':hover': {
        backgroundColor: Colors.SKY_BLUE_HOVER,
        border: 'solid 1px transparent',
        color: '#fff',
      },
      backgroundColor: 'transparent',
      border: `solid 1px ${Colors.SILVER}`,
      color: Colors.DARK_TWO,
      fontSize: 13,
      fontWeight: 'normal',
      marginLeft: 10,
    }
    return <div style={style}>
      <Modal
        isShown={this.state.isFeedbackModalShown}
        title="Proposer une idée"
        onClose={() => this.setState({isFeedbackModalShown: false})}
        style={{fontSize: 14, fontStyle: 'normal'}}>
        <div style={{display: 'flex', flexDirection: 'column', margin: '25px 50px'}}>
          <textarea
            style={{height: 300, padding: '15px 12px', width: 380}}
            onChange={event => this.setState({hasFeedback: !!event.target.value})}
            placeholder="Écrivez votre commentaire ici" ref={feedbackDom => {
              this.feedbackDom = feedbackDom
            }} />
        </div>
        <div style={{marginBottom: 25, textAlign: 'center'}}>
          <Button disabled={!hasFeedback} onClick={hasFeedback ? this.sendFeedback : null}>
            Envoyer
          </Button>
        </div>
      </Modal>
      <Button
        style={buttonStyle} isNarrow={true}
        onClick={() => this.setState({isFeedbackModalShown: true})}>
        {children}
      </Button>
    </div>
  }
}
const FeedbackButton = connect()(FeedbackButtonBase)


export {AdviceCard, ExpandedAdviceCardContent}

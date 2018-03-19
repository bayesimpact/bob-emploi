import omit from 'lodash/omit'
import CheckIcon from 'mdi-react/CheckIcon'
import React from 'react'
import PropTypes from 'prop-types'
import Raven from 'raven-js'
import {connect} from 'react-redux'
import Swipeable from 'react-swipeable'
import VisibilitySensor from 'react-visibility-sensor'

import {adviceCardIsShown, advicePageIsShown, scoreAdvice, selectAdvice,
  seeAdvice, sendAdviceFeedback} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {genderize, lowerFirstLetter, getAdviceModules} from 'store/french'
import {youForUser} from 'store/user'

import constructionImage from 'images/construction-picto.svg'
import rocketIcon from 'images/rocket.svg'
import starIcon from 'images/star.svg'
import starOutlineIcon from 'images/star-outline.svg'
import {Modal} from 'components/modal'
import {Button, Colors, SmoothTransitions, StringJoiner, Styles, Tag,
  colorToAlpha} from 'components/theme'
import {TipsList} from 'components/tips'

// TODO(cyrille): Use AdviceCard in those or drop them.
import AssociationHelp from './advisor/association_help'
import BetterJobInGroup from './advisor/better_job_in_group'
import BodyLanguage from './advisor/body_language'
import CivicService from './advisor/civic_service'
import Commute from './advisor/commute'
import CreateYourCompany from './advisor/create_your_company'
import DrivingLicenseEuro from './advisor/driving_license_euro'
import DrivingLicenseLowIncome from './advisor/driving_license_low_income'
import DrivingLicenseWritten from './advisor/driving_license_written'
import Events from './advisor/events'
import FollowUp from './advisor/follow_up'
import FromServer from './advisor/from_server'
import ImmersionMilo from './advisor/immersion_milo'
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
import ReorientJobbing from './advisor/reorient_jobbing'
import ReorientCloseJob from './advisor/reorient_to_close_job'
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
  'body-language': BodyLanguage,
  'civic-service': CivicService,
  'commute': Commute,
  'create-your-company': CreateYourCompany,
  'driving-license-euro': DrivingLicenseEuro,
  'driving-license-low-income': DrivingLicenseLowIncome,
  'driving-license-written': DrivingLicenseWritten,
  'events': Events,
  'find-a-jobboard': JobBoards,
  'follow-up': FollowUp,
  'fresh-resume': ImproveResume,
  'immersion-milo': ImmersionMilo,
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
  'reorient-jobbing': ReorientJobbing,
  'reorient-to-close-job': ReorientCloseJob,
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


const missingPicto = new Set()


function getAdvicePicto(adviceId) {
  const module = ADVICE_MODULES[adviceId] || null
  if (module && !module.Picto && Raven.captureMessage && !missingPicto.has(adviceId)) {
    Raven.captureMessage(`Picto is missing for "${adviceId}".`)
    missingPicto.add(adviceId)
  }
  return module && module.Picto || null
}


class WhiteAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    isFeedbackButtonShown: PropTypes.bool,
    isScorable: PropTypes.bool,
    isTitleShown: PropTypes.bool.isRequired,
    onClick: PropTypes.func,
    onExpandChanged: PropTypes.func,
    onHoverChanged: PropTypes.func,
    onShow: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  static defaultProps = {
    isTitleShown: true,
  }

  state = {
    hasBeenSeen: false,
    isHovered: false,
  }

  componentWillMount() {
    const {advice, dispatch, project} = this.props
    dispatch(adviceCardIsShown(project, advice))
  }

  changeExpand = isExpanded => {
    const {onExpandChanged} = this.props
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

  handleCardClick = event => {
    const {onClick} = this.props
    if (onClick) {
      onClick()
    } else {
      this.gotoAdvicePage('advice-card')(event)
    }
  }

  renderTitle() {
    const {advice, isScorable, onClick, userYou} = this.props
    const style = {
      alignItems: 'center',
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 500,
    }
    const tagStyle = {
      backgroundColor: Colors.GREENISH_TEAL,
      marginLeft: 20,
    }
    const starStyle = {
      cursor: 'pointer',
      width: 20,
    }
    return <header style={style}>
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        {getAdviceTitle(advice, userYou)}
      </span>
      {/* TODO(cyrille): Remove if unused.*/}
      {(onClick || !isScorable) ? null : <div
        className="tooltip" style={{alignItems: 'center', display: 'flex', marginLeft: 15}}>
        <img
          src={advice.score ? starIcon : starOutlineIcon}
          style={starStyle} onClick={this.handleStarClick} alt="Très bon conseil" />
        <div
          className="tooltiptext tooltip-bottom"
          style={{fontSize: 13, fontWeight: 'initial', padding: '10px 13px', width: 160}}>
          Ce conseil m'est utile
        </div>
      </div>}
      <Tag style={tagStyle}>Nouveau</Tag>
      <span style={{flex: 1}} />
    </header>
  }

  renderExpandButtonBar(style) {
    const {advice, onClick, userYou} = this.props
    const {isHovered} = this.state
    const {callToAction} = getAdviceModules(userYou)[advice.adviceId] || {}
    const isExpandable = !onClick
    const plusStyle = {
      backgroundColor: isHovered ? Colors.BOB_BLUE : 'transparent',
      border: `solid 1px ${isHovered ? Colors.BOB_BLUE : Colors.MODAL_PROJECT_GREY}`,
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
    const text = callToAction || 'Voir plus'
    const wrappedText = isExpandable ? text :
      `Ajoute${userYou('', 'z')} ce conseil à ${userYou('ta', 'votre')} ` +
      `sélection pour ${lowerFirstLetter(text)}.`
    return <div style={{alignItems: 'center', display: 'flex', ...style}}>
      {isExpandable ? <span style={plusStyle}>+</span> : null}
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        {wrappedText}
      </span>
    </div>
  }

  render() {
    const {advice, isFeedbackButtonShown, isTitleShown,
      project, style, userYou} = this.props
    const cardStyle = {
      color: Colors.CHARCOAL_GREY,
      ...SmoothTransitions,
      ...style,
    }
    const headerStyle = {
      borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      padding: '35px 40px',
    }
    return <VisibilitySensor
      active={!this.state.hasBeenSeen} intervalDelay={250} minTopValue={10}
      partialVisibility={true} onChange={this.handleVisibilityChange}>
      <section
        style={cardStyle}
        onMouseEnter={() => this.changeHover(true)}
        onMouseLeave={() => this.changeHover(false)}>
        {isTitleShown ? <header style={headerStyle}>
          {this.renderTitle()}
        </header> : null}
        <ExpandedAdviceCardContent {...this.props} />
        <TipsList {...{advice, project, userYou}} />
        {isFeedbackButtonShown ? <div
          style={{alignItems: 'center', display: 'flex', fontSize: 13, marginTop: 30}}>
          {userYou('Tu as', 'Vous avez')} d'autres exemples à partager
          <FeedbackButton advice={advice} project={project}>
            Proposer une idée
          </FeedbackButton>
        </div> : null}
      </section>
    </VisibilitySensor>
  }
}

// TODO(cyrille): Refacto this with WhiteAdviceCard.
class AdviceCardBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    refDom: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {advice, refDom, style, ...extraProps} = this.props
    return <div style={style} ref={refDom} id={advice.adviceId}>
      <WhiteAdviceCard {...extraProps} advice={advice} />
    </div>
  }
}
const AdviceCard = connect(({app, user}, {advice: {adviceId}, project: {projectId}}) => ({
  tips: (app.adviceTips[projectId] || {})[adviceId] || [],
  userYou: youForUser(user),
}))(AdviceCardBase)


class ExplorerAdviceCardBase extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      explanations: PropTypes.arrayOf(PropTypes.string.isRequired),
      numStars: PropTypes.number,
      score: PropTypes.number,
    }).isRequired,
    onClick: PropTypes.func,
    onSelectionTransitionEnd: PropTypes.func,
    onSwipedLeft: PropTypes.func,
    onSwipedRight: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    hasJustBeenSelected: false,
  }

  componentWillReceiveProps(nextProps) {
    const {advice: {score}} = nextProps
    if (score && !this.props.advice.score) {
      this.setState({hasJustBeenSelected: true})
      this.timeout = setTimeout(() => {
        const {onSelectionTransitionEnd} = this.props
        this.setState({hasJustBeenSelected: false})
        onSelectionTransitionEnd && onSelectionTransitionEnd()
      }, 800)
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  renderLeftPanel(style) {
    const {advice, userYou} = this.props
    const {isMobileVersion} = this.context
    const title = getAdviceTitle(advice)
    const {explanations: staticExplanations} = getAdviceModules(userYou)[advice.adviceId] || {}
    const allExplanations = (staticExplanations || []).concat(advice.explanations || [])
    const containerStyle = {
      background: '#fff',
      color: Colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      padding: isMobileVersion ? '15px 30px' : '25px 30px',
      ...style,
    }
    const titleStyle = {
      alignItems: 'center',
      borderBottom: isMobileVersion ? 'initial' : `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      color: Colors.DARK,
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      flexShrink: 0,
      fontSize: isMobileVersion ? 20 : 25,
      fontWeight: 'bold',
      lineHeight: 1.2,
      marginBottom: 20,
      paddingBottom: isMobileVersion ? 'initial' : 25,
    }
    const explanationsContainerStyle = {
      marginBottom: 20,
      overflow: isMobileVersion ? 'hidden' : 'initial',
    }
    const explanationsTitleStyle = {
      color: Colors.BOB_BLUE,
      fontSize: 11,
      fontStyle: 'italic',
      fontWeight: 'bold',
      textTransform: 'uppercase',
    }
    const explanationStyle = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      borderRadius: 4,
      display: 'inline-block',
      fontSize: 13,
      fontWeight: 500,
      padding: '8px 10px 6px',
    }
    const explanationSeparator = <span style={{...explanationsTitleStyle, margin: '0 5px'}}>
      +
    </span>
    const selectForMoreStyle = {
      color: Colors.BOB_BLUE,
      fontSize: 15,
      fontStyle: 'italic',
      fontWeight: 500,
      textAlign: 'center',
    }
    const pictoStyle = {
      borderRadius: isMobileVersion ? 48 : 'initial',
      boxShadow: isMobileVersion ? '0 11px 13px 0 rgba(0, 0, 0, 0.2)' : 'initial',
      height: 48,
      [isMobileVersion ? 'marginBottom' : 'marginRight']: 14,
      maxWidth: 48,
    }
    return <div style={containerStyle}>
      <div style={titleStyle}>
        <AdvicePicto style={pictoStyle} adviceId={advice.adviceId} />
        <span style={{...Styles.CENTER_FONT_VERTICALLY, flex: 1}}>{title}</span>
      </div>
      {allExplanations.length ? <div style={explanationsContainerStyle}>
        <span style={{...explanationsTitleStyle, marginRight: 10}}>
          Parce que&nbsp;:
        </span>
        <StringJoiner separator={explanationSeparator} lastSeparator={explanationSeparator}>
          {allExplanations.map((explanation, index) => <span
            style={explanationStyle} key={`explanation-${index}`}>
            {explanation}
          </span>)}
        </StringJoiner>
      </div> : null}
      <div style={{flex: 1, overflow: 'hidden', pointerEvents: 'none', position: 'relative'}}>
        <ExpandedAdviceCardContent {...omit(this.props, ['style'])} />
        <div style={{
          backgroundImage: 'linear-gradient(to bottom, transparent, #fff)',
          bottom: 0,
          height: 90,
          left: 0,
          position: 'absolute',
          right: 0,
        }} />
      </div>
      <div style={selectForMoreStyle}>
        Découvre{userYou('', 'z')} d'autres astuces en sélectionnant ce conseil.
      </div>
    </div>
  }

  renderRightPanel(style) {
    const {advice: {adviceId, numStars}, userYou} = this.props
    const {isMobileVersion} = this.context
    const {userGainCallout, userGainDetails} = getAdviceModules(userYou)[adviceId] || {}
    if (!userGainCallout && !userGainDetails && isMobileVersion) {
      return null
    }
    const numRockets = Math.round((numStars || 0) * 2 - 1)
    const containerStyle = {
      alignItems: isMobileVersion ? 'stretch' : 'center',
      backgroundImage: isMobileVersion ?
        `linear-gradient(101deg, ${Colors.BOB_BLUE}, ${Colors.ROBINS_EGG})` :
        `linear-gradient(to bottom, ${Colors.BOB_BLUE}, ${Colors.ROBINS_EGG})`,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 500,
      justifyContent: 'center',
      position: 'relative',
      textAlign: 'center',
      ...style,
    }
    const titleStyle = {
      fontSize: 11,
      fontWeight: 'bold',
      textTransform: 'uppercase',
    }
    const rocketsStyle = {
      left: 0,
      position: 'absolute',
      right: 0,
      top: 30,
      ...titleStyle,
    }
    const userGainStyle = isMobileVersion ? {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
    } : undefined
    const calloutStyle = {
      alignItems: 'center',
      border: `solid ${isMobileVersion ? 3 : 5}px rgba(255, 255, 255, .4)`,
      borderRadius: 60,
      display: 'flex',
      flexShrink: 0,
      fontSize: isMobileVersion ? 22.5 : 50,
      fontStyle: 'normal',
      height: isMobileVersion ? 51 : 114,
      justifyContent: 'center',
      lineHeight: .8,
      margin: isMobileVersion ? '8px 0 8px 20px' : '20px auto',
      width: isMobileVersion ? 51 : 114,
    }
    return <div style={containerStyle}>
      {isMobileVersion ? null : <div style={rocketsStyle}>
        <div style={{marginBottom: 10}}>Notre avis</div>
        {new Array(numRockets).fill().map((_, index) =>
          <img style={{height: 20}} src={rocketIcon} key={`rocket-${index}`} alt="*" />)}
      </div>}
      {userGainCallout || userGainDetails ? <div style={userGainStyle}>
        {isMobileVersion ? null : <div style={titleStyle}>
          Votre bénéfice
        </div>}
        <div style={calloutStyle}>
          <span style={Styles.CENTER_FONT_VERTICALLY}>
            {userGainCallout}
          </span>
        </div>
        <div style={{fontSize: 16, padding: isMobileVersion ? '0 15px' : '0 20px'}}>
          {userGainDetails}
        </div>
      </div> : null}
    </div>
  }

  renderSelectionOverlay() {
    const {advice: {score}, userYou} = this.props
    const {hasJustBeenSelected} = this.state
    const selectionStyle = {
      alignItems: 'center',
      backgroundColor: colorToAlpha(Colors.BOB_BLUE, .4),
      bottom: 0,
      display: 'flex',
      justifyContent: 'center',
      left: 0,
      opacity: score ? 1 : 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      top: 0,
      ...SmoothTransitions,
    }
    const selectMarkStyle = {
      alignItems: 'center',
      backgroundColor: colorToAlpha(Colors.GREENISH_TEAL, .9),
      border: 'solid 3px #fff',
      borderRadius: 40,
      display: 'flex',
      height: 80,
      justifyContent: 'center',
      position: 'relative',
      width: 80,
    }
    const selectedTextStyle = {
      backgroundColor: 'rgba(0, 0, 0, .4)',
      borderRadius: 5,
      color: '#fff',
      fontSize: 17,
      fontWeight: 500,
      marginTop: 20,
      opacity: hasJustBeenSelected ? 1 : 0,
      padding: '8px 10px 4px',
      position: 'absolute',
      textAlign: 'center',
      top: '100%',
      width: 240,
      ...SmoothTransitions,
    }
    return <div style={selectionStyle}>
      <div style={selectMarkStyle}>
        <CheckIcon fill="#fff" height={35} />
        <div style={selectedTextStyle}>
          Conseil ajouté à {userYou('ta', 'votre')} liste
        </div>
      </div>
    </div>
  }

  render() {
    const {onClick, onSwipedLeft, onSwipedRight, style} = this.props
    const {isMobileVersion} = this.context
    const containerStyle = {
      boxShadow: '0 10px 30px rgba(0, 0, 0, .2)',
      cursor: onClick ? 'pointer' : 'initial',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      position: 'relative',
      ...style,
    }
    return <Swipeable
      style={containerStyle} onClick={onClick} onSwipedLeft={onSwipedLeft}
      onSwipedRight={onSwipedRight}>
      {this.renderLeftPanel({flex: 3})}
      {this.renderRightPanel({flex: 1})}
      {this.renderSelectionOverlay()}
    </Swipeable>
  }
}
const ExplorerAdviceCard = connect(({user}) => ({
  userYou: youForUser(user),
}))(ExplorerAdviceCardBase)


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    profile: PropTypes.object.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  renderGeneric(style) {
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      ...style,
    }
    const {profile, userYou} = this.props
    const gender = profile.gender
    return <div style={containerStyle}>
      <div style={{flex: 1, textAlign: 'center'}}>
        <img src={constructionImage} alt="" />
        <div style={{fontStyle: 'italic', fontWeight: 500}}>
          Module en construction
        </div>
      </div>

      <div style={{flex: 2}}>
        <p>
          {userYou('Tu seras ', 'Vous serez ')}
          {genderize('notifié', 'notifiée', 'notifié', gender)} lorsque le module
          sera prêt pour {userYou("t'aider ", 'vous aider ')}à avancer sur ce sujet.
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
    userYou: PropTypes.func.isRequired,
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
    const {children, style, userYou} = this.props
    const {hasFeedback} = this.state
    const buttonStyle = {
      ':hover': {
        backgroundColor: Colors.BOB_BLUE_HOVER,
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
            placeholder={
              userYou('Écris ton commentaire ici', 'Écrivez votre commentaire ici')
            }
            ref={feedbackDom => {
              this.feedbackDom = feedbackDom
            }} />
        </div>
        <div style={{marginBottom: 25, textAlign: 'center'}}>
          <Button
            disabled={!hasFeedback} onClick={hasFeedback ? this.sendFeedback : null} isRound={true}>
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
const FeedbackButton = connect(({user}) =>
  ({userYou: youForUser(user)}))(FeedbackButtonBase)


class AdvicePicto extends React.Component {
  static propTypes = {
    adviceId: PropTypes.string.isRequired,
  }

  state = {
    pictoSrc: getAdvicePicto(this.props.adviceId),
  }

  componentWillReceiveProps(nextProps) {
    const {adviceId} = nextProps
    if (adviceId !== this.props.adviceId) {
      this.setState({pictoSrc: getAdvicePicto(adviceId)})
    }
  }

  render() {
    const {pictoSrc} = this.state
    if (!pictoSrc) {
      return null
    }
    return <img src={pictoSrc} alt="" {...omit(this.props, 'adviceId')} />
  }
}


export {AdviceCard, ExpandedAdviceCardContent, ExplorerAdviceCard, AdvicePicto}

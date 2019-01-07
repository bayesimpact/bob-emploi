import _omit from 'lodash/omit'
import React from 'react'
import PropTypes from 'prop-types'
import Raven from 'raven-js'
import {connect} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import {adviceCardIsShown, exploreAdvice, seeAdvice} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {genderize, getAdviceModules} from 'store/french'
import {youForUser} from 'store/user'

import constructionImage from 'images/construction-picto.svg'
import {RocketChain} from 'components/rocket_chain'
import {isMobileVersion} from 'components/mobile'
import {StringJoiner} from 'components/theme'
import {TipsList} from 'components/tips'

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
import LongTermMom from './advisor/long_term_mom'
import MotivationEmail from './advisor/motivation_email'
import NetworkApplication from './advisor/network_bad'
import NetworkApplicationMedium from './advisor/network_medium'
import NetworkApplicationGood from './advisor/network_good'
import OnlineSalons from './advisor/online_salons'
import OtherWorkEnv from './advisor/other_work_env'
import Relocate from './advisor/relocate'
import ReorientJobbing from './advisor/reorient_jobbing'
import ReorientCloseJob from './advisor/reorient_to_close_job'
import SeasonalRelocate from './advisor/seasonal_relocate'
import Senior from './advisor/senior'
import SkillForFuture from './advisor/skill_for_future'
import SpontaneousApplication from './advisor/spontaneous'
import Training from './advisor/training'
import Volunteer from './advisor/volunteer'
import Vae from './advisor/vae'
import WowBaker from './advisor/wow_baker'
import WowHairdresser from './advisor/wow_hairdresser'


// Map of advice recommendation modules keyed by advice module IDs.
// Exported for testing only.
export const ADVICE_MODULES = {
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
  'long-term-mom': LongTermMom,
  'motivation-email': MotivationEmail,
  'network-application': NetworkApplication,
  'network-application-good': NetworkApplicationGood,
  'network-application-medium': NetworkApplicationMedium,
  'online-salons': OnlineSalons,
  'other-work-env': OtherWorkEnv,
  'relocate': Relocate,
  'reorient-jobbing': ReorientJobbing,
  'reorient-to-close-job': ReorientCloseJob,
  'seasonal-relocate': SeasonalRelocate,
  'senior': Senior,
  'skill-for-future': SkillForFuture,
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


class AdviceCardBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    onShow: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    hasBeenSeen: false,
  }

  componentDidMount() {
    const {advice, dispatch, project} = this.props
    dispatch(adviceCardIsShown(project, advice))
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

  render() {
    const {advice, project, style, userYou} = this.props
    return <div style={style} id={advice.adviceId}>
      <VisibilitySensor
        active={!this.state.hasBeenSeen} intervalDelay={250} minTopValue={10}
        partialVisibility={true} onChange={this.handleVisibilityChange}>
        <section style={{color: colors.CHARCOAL_GREY}}>
          <ExpandedAdviceCardContent style={{fontSize: 16}} {...this.props} />
          <TipsList {...{advice, project, userYou}} />
        </section>
      </VisibilitySensor>
    </div>
  }
}
const AdviceCard = connect(({user}) => ({userYou: youForUser(user)}))(AdviceCardBase)


class ExplorerAdviceCardBase extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      explanations: PropTypes.arrayOf(PropTypes.string.isRequired),
      numStars: PropTypes.number,
      score: PropTypes.number,
    }).isRequired,
    howToSeeMore: PropTypes.node,
    onClick: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  renderLeftPanel(style) {
    const {advice, howToSeeMore, userYou} = this.props
    const title = getAdviceTitle(advice, userYou)
    const {explanations: staticExplanations} = getAdviceModules(userYou)[advice.adviceId] || {}
    const allExplanations = (staticExplanations || []).concat(advice.explanations || [])
    const containerStyle = {
      background: '#fff',
      color: colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      padding: isMobileVersion ? '15px 30px' : '25px 30px',
      ...style,
    }
    const titleStyle = {
      alignItems: 'center',
      borderBottom: isMobileVersion ? 'initial' : `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.DARK,
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
      color: colors.BOB_BLUE,
      fontSize: 11,
      fontStyle: 'italic',
      fontWeight: 'bold',
      textTransform: 'uppercase',
    }
    const explanationStyle = {
      backgroundColor: colors.MODAL_PROJECT_GREY,
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
      color: colors.BOB_BLUE,
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
    const pointerEvents = howToSeeMore ? 'none' : 'initial'
    return <div style={containerStyle}>
      <div style={titleStyle}>
        <AdvicePicto style={pictoStyle} adviceId={advice.adviceId} />
        <span style={{flex: 1}}>{title}</span>
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
      <div
        style={{flex: 1, fontSize: 16, overflow: 'hidden', pointerEvents, position: 'relative'}}>
        <ExpandedAdviceCardContent
          backgroundColor={containerStyle.background} {..._omit(this.props, ['style'])} />
        {howToSeeMore ? <div style={{
          backgroundImage: 'linear-gradient(to bottom, transparent, #fff)',
          bottom: 0,
          height: 90,
          left: 0,
          position: 'absolute',
          right: 0,
        }} /> : null}
      </div>
      <div style={selectForMoreStyle}>
        {howToSeeMore}
      </div>
    </div>
  }

  renderRightPanel(style) {
    const {advice: {adviceId, numStars}, userYou} = this.props
    const {userGainCallout, userGainDetails} = getAdviceModules(userYou)[adviceId] || {}
    if (!userGainCallout && !userGainDetails && isMobileVersion) {
      return null
    }
    const containerStyle = {
      alignItems: isMobileVersion ? 'stretch' : 'center',
      backgroundImage: isMobileVersion ?
        `linear-gradient(101deg, ${colors.BOB_BLUE}, ${colors.ROBINS_EGG})` :
        `linear-gradient(to bottom, ${colors.BOB_BLUE}, ${colors.ROBINS_EGG})`,
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
        <RocketChain numStars={numStars} rocketHeight={20} />
      </div>}
      {userGainCallout || userGainDetails ? <div style={userGainStyle}>
        {isMobileVersion ? null : <div style={titleStyle}>
          Votre bénéfice
        </div>}
        <div style={calloutStyle}>
          {userGainCallout}
        </div>
        <div style={{fontSize: 16, padding: isMobileVersion ? '0 15px' : '0 20px'}}>
          {userGainDetails}
        </div>
      </div> : null}
    </div>
  }

  render() {
    const {onClick, style} = this.props
    const containerStyle = {
      boxShadow: '0 10px 30px rgba(0, 0, 0, .2)',
      cursor: onClick ? 'pointer' : 'initial',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      position: 'relative',
      ...style,
    }
    return <div style={containerStyle} onClick={onClick}>
      {this.renderLeftPanel({flex: 3})}
      {this.renderRightPanel({flex: 1})}
    </div>
  }
}
const ExplorerAdviceCard = connect(({user}) => ({
  userYou: youForUser(user),
}))(ExplorerAdviceCardBase)


// TODO(pascal): Add a visual marker if this advice is only shown to alpha users.
class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.shape({
      projectId: PropTypes.string,
    }).isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  handleExplore = visualElement => {
    const {advice, dispatch, project} = this.props
    dispatch(exploreAdvice(project, advice, visualElement))
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
      return <PageComponent {...this.props} onExplore={this.handleExplore} />
    }
    return this.renderGeneric(style)
  }
}
const ExpandedAdviceCardContent = connect(({user}) => ({
  userYou: youForUser(user),
}))(ExpandedAdviceCardContentBase)


class AdvicePicto extends React.Component {
  static propTypes = {
    adviceId: PropTypes.string.isRequired,
  }

  state = {
    adviceId: this.props.adviceId,
    pictoSrc: getAdvicePicto(this.props.adviceId),
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const {adviceId} = nextProps
    if (adviceId === prevState.adviceId) {
      return null
    }
    return {
      adviceId,
      pictoSrc: getAdvicePicto(adviceId),
    }
  }

  render() {
    const {pictoSrc} = this.state
    if (!pictoSrc) {
      return null
    }
    return <img src={pictoSrc} alt="" {..._omit(this.props, 'adviceId')} />
  }
}


export {AdviceCard, ExpandedAdviceCardContent, ExplorerAdviceCard, AdvicePicto}

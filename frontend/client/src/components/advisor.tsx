import _memoize from 'lodash/memoize'
import React from 'react'
import PropTypes from 'prop-types'
import Raven from 'raven-js'
import {connect} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RootState, adviceCardIsShown, exploreAdvice,
  seeAdvice} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {YouChooser, genderize, getAdviceModules, upperFirstLetter} from 'store/french'
import {youForUser} from 'store/user'

import constructionImage from 'images/construction-picto.svg'
import defaultPicto from 'images/default-picto.svg'
import {AlphaTag} from 'components/pages/connected/project/advice'
import {RocketChain} from 'components/rocket_chain'
import {isMobileVersion} from 'components/mobile'
import {StringJoiner} from 'components/theme'
import {TipsList} from 'components/tips'

import {CardProps, WithAdvice} from './advisor/base'
import Alternance from './advisor/alternance'
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
import ExploreOtherJobs from './advisor/explore_other_jobs'
import FollowUp from './advisor/follow_up'
import FromServer from './advisor/from_server'
import Immersion from './advisor/immersion'
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
import PersonalityTest from './advisor/personality_test'
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


interface Module {
  ExpandedAdviceCardContent?: React.ComponentType<CardProps>
  NewPicto?: string
  Picto?: string
  TakeAway?: string | React.ComponentType<WithAdvice>
}


// Map of advice recommendation modules keyed by advice module IDs.
// Exported for testing only.
export const ADVICE_MODULES: {[moduleId: string]: Module} = {
  'alternance': Alternance,
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
  'explore-other-jobs': ExploreOtherJobs,
  'find-a-jobboard': JobBoards,
  'follow-up': FollowUp,
  'fresh-resume': ImproveResume,
  'immersion': Immersion,
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
  'personality-test': PersonalityTest,
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
}


const missingPicto = new Set()


function getAdvicePicto(adviceId, shouldBeNew): string {
  const module = ADVICE_MODULES[adviceId] || null
  // TODO(cyrille): Replace NewPicto with Picto once all old pictos have been removed.
  if (module && !module.NewPicto && Raven.captureMessage && !missingPicto.has(adviceId)) {
    Raven.captureMessage(`Picto is missing for "${adviceId}".`)
    missingPicto.add(adviceId)
  }
  return module && module.NewPicto || (!shouldBeNew && module.Picto) || defaultPicto
}


interface AdviceCardProps extends WithAdvice {
  areTipsShown?: boolean
  dispatch: DispatchAllActions
  onShow?: () => void
  style?: React.CSSProperties
  userYou: YouChooser
}


class AdviceCardBase extends React.PureComponent<AdviceCardProps, {hasBeenSeen: boolean}> {
  public static propTypes = {
    advice: PropTypes.object.isRequired,
    areTipsShown: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
    onShow: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    hasBeenSeen: false,
  }

  public componentDidMount(): void {
    const {advice, dispatch, project} = this.props
    dispatch(adviceCardIsShown(project, advice))
  }

  private handleVisibilityChange = (isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    const {advice, dispatch, onShow, project} = this.props
    this.setState({hasBeenSeen: true})
    dispatch(seeAdvice(project, advice))
    onShow && onShow()
  }

  public render(): React.ReactNode {
    const {advice, areTipsShown, project, style, userYou} = this.props
    return <div style={style} id={advice.adviceId}>
      <VisibilitySensor
        active={!this.state.hasBeenSeen} intervalDelay={250} minTopValue={10}
        partialVisibility={true} onChange={this.handleVisibilityChange}>
        <section>
          {/* TODO(cyrille): Enforce the fontSize somehow, since the Component does not
            expect a style prop. */}
          <ExpandedAdviceCardContent style={{fontSize: 16}} {...this.props} />
          {areTipsShown ? <TipsList {...{advice, project, userYou}} /> : null}
        </section>
      </VisibilitySensor>
    </div>
  }
}
const AdviceCard = connect(({user}: RootState): {userYou: YouChooser} =>
  ({userYou: youForUser(user)}))(AdviceCardBase)


export interface ExplorerAdviceCardConfig extends ExpandedAdviceCardConfig {
  howToSeeMore?: React.ReactNode
  onClick: () => void
  style?: React.CSSProperties
}


interface ExplorerAdviceCardProps extends ExplorerAdviceCardConfig {
  userYou: YouChooser
}


class ExplorerAdviceCardBase extends React.PureComponent<ExplorerAdviceCardProps> {
  public static propTypes = {
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

  private renderLeftPanel(style: React.CSSProperties): React.ReactNode {
    const {advice, howToSeeMore, userYou} = this.props
    const {howToSeeMore: omittedHowToSeeMore, style: omittedStyle, ...otherProps} = this.props
    const title = getAdviceTitle(advice, userYou)
    const {explanations: staticExplanations = []} = getAdviceModules(userYou)[advice.adviceId] || {}
    const allExplanations = (staticExplanations || []).concat(advice.explanations || [])
    const containerStyle: React.CSSProperties = {
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      padding: isMobileVersion ? '15px 30px' : '25px 30px',
      ...style,
    }
    const titleStyle: React.CSSProperties = {
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
    const explanationsContainerStyle: React.CSSProperties = {
      marginBottom: 20,
      overflow: isMobileVersion ? 'hidden' : 'initial',
    }
    const explanationsTitleStyle: React.CSSProperties = {
      color: colors.BOB_BLUE,
      fontSize: 11,
      fontStyle: 'italic',
      fontWeight: 'bold',
      textTransform: 'uppercase',
    }
    const explanationStyle: React.CSSProperties = {
      backgroundColor: colors.MODAL_PROJECT_GREY,
      borderRadius: 4,
      display: 'inline-block',
      fontSize: 13,
      fontWeight: 500,
      margin: 2,
      padding: '8px 10px',
    }
    const explanationSeparator = <span style={{...explanationsTitleStyle, margin: '0 5px'}}>
      +
    </span>
    const selectForMoreStyle: React.CSSProperties = {
      color: colors.BOB_BLUE,
      fontSize: 15,
      fontStyle: 'italic',
      fontWeight: 500,
      textAlign: 'center',
    }
    const pictoStyle: React.CSSProperties = {
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
          {allExplanations.map((explanation, index): React.ReactNode => <span
            style={explanationStyle} key={`explanation-${index}`}>
            {explanation}
          </span>)}
        </StringJoiner>
      </div> : null}
      <div
        style={{flex: 1, fontSize: 16, overflow: 'hidden', pointerEvents, position: 'relative'}}>
        <ExpandedAdviceCardContent backgroundColor={containerStyle.background} {...otherProps} />
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

  private renderRightPanel(style: React.CSSProperties): React.ReactNode {
    const {advice: {adviceId, numStars}, userYou} = this.props
    const {userGainCallout = undefined, userGainDetails = undefined} =
      getAdviceModules(userYou)[adviceId] || {}
    if (!userGainCallout && !userGainDetails && isMobileVersion) {
      return null
    }
    const containerStyle: React.CSSProperties = {
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
    const titleStyle: React.CSSProperties = {
      fontSize: 11,
      fontWeight: 'bold',
      textTransform: 'uppercase',
    }
    const rocketsStyle: React.CSSProperties = {
      left: 0,
      position: 'absolute',
      right: 0,
      top: 30,
      ...titleStyle,
    }
    const userGainStyle: React.CSSProperties = isMobileVersion ? {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
    } : undefined
    const calloutStyle: React.CSSProperties = {
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

  public render(): React.ReactNode {
    const {onClick, style} = this.props
    const containerStyle: React.CSSProperties = {
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
const ExplorerAdviceCard = connect(({user}: RootState): {userYou: YouChooser} => ({
  userYou: youForUser(user),
}))(ExplorerAdviceCardBase)


export interface ExpandedAdviceCardConfig extends WithAdvice {
  backgroundColor?: string | number
  style?: React.CSSProperties
}


interface ExpandedAdviceCardConnectedProps {
  profile: bayes.bob.UserProfile
  userYou: YouChooser
}


interface ExpandedAdviceCardProps
  extends ExpandedAdviceCardConfig, ExpandedAdviceCardConnectedProps {
  dispatch: DispatchAllActions
}


// TODO(pascal): Add a visual marker if this advice is only shown to alpha users.
class ExpandedAdviceCardContentBase extends React.PureComponent<ExpandedAdviceCardProps> {
  public static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.shape({
      projectId: PropTypes.string,
    }).isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  private handleExplore = _memoize((visualElement: string): (() => void) => (): void => {
    const {advice, dispatch, project} = this.props
    dispatch(exploreAdvice(project, advice, visualElement))
  })

  private renderGeneric(style: React.CSSProperties): React.ReactNode {
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

  public render(): React.ReactNode {
    const {advice, style} = this.props
    const module = ADVICE_MODULES[advice.adviceId] || null
    const PageComponent = module && module.ExpandedAdviceCardContent || null
    if (PageComponent) {
      return <PageComponent {...this.props} handleExplore={this.handleExplore} />
    }
    return this.renderGeneric(style)
  }
}
const ExpandedAdviceCardContent =
  connect(({user}: RootState): ExpandedAdviceCardConnectedProps => ({
    profile: user.profile,
    userYou: youForUser(user),
  }))(ExpandedAdviceCardContentBase)


interface MethodHeaderProps {
  advice: bayes.bob.Advice
  isTakeAwayShown?: boolean
  project: bayes.bob.Project
  style?: React.CSSProperties
  title?: string
  userYou: YouChooser
}


class MethodHeader extends React.PureComponent<MethodHeaderProps> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    isTakeAwayShown: PropTypes.bool,
    project: PropTypes.shape({
      projectId: PropTypes.string.isRequired,
    }),
    style: PropTypes.object,
    title: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  private renderTakeaway(): React.ReactNode {
    const {advice, project} = this.props
    const module = ADVICE_MODULES[advice.adviceId] || null
    // TakeAway is either a string or a component.
    const TakeAway = module && module.TakeAway || ''
    const takeAwayStyle: React.CSSProperties = {
      color: colors.BOB_BLUE,
      margin: '0 10px',
      textAlign: 'center',
      width: 100,
    }
    return <div style={takeAwayStyle}>
      {typeof TakeAway === 'string' ? TakeAway : <TakeAway advice={advice} project={project} />}
    </div>
  }

  public render(): React.ReactNode {
    const {advice, isTakeAwayShown, style, title, userYou} = this.props
    const {adviceId, isForAlphaOnly} = advice
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'row-reverse' : 'row',
      ...style,
    }
    const methodStyle: React.CSSProperties = {
      color: colors.WARM_GREY,
      fontSize: 12,
      textTransform: 'uppercase',
    }
    const titleStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      fontSize: isMobileVersion ? 16 : 18,
      ...!isMobileVersion && {fontWeight: 'bold'},
    }
    const pictoStyle: React.CSSProperties = {
      marginRight: 15,
      width: isMobileVersion ? 35 : 40,
    }
    const shownTitle = upperFirstLetter(title || getAdviceTitle(advice, userYou))
    return <header style={containerStyle}>
      <AdvicePicto adviceId={adviceId} style={pictoStyle} shouldBeNew={true} />
      <div style={{flex: 1, margin: '0 15'}}>
        {isMobileVersion ? null : <div style={methodStyle}>Méthode</div>}
        <div style={titleStyle}>
          {shownTitle}
          {isForAlphaOnly ? <AlphaTag style={{marginLeft: 10}} /> : null}
        </div>
      </div>
      {isTakeAwayShown && !isMobileVersion ? this.renderTakeaway() : null}
    </header>
  }
}


interface MethodProps extends MethodHeaderProps, WithAdvice {
  style?: React.CSSProperties
  userYou: YouChooser
}


class ObservationMethod extends React.PureComponent<MethodProps> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    project: PropTypes.shape({
      projectId: PropTypes.string.isRequired,
    }).isRequired,
  }

  public render(): React.ReactNode {
    return <MethodHeader isTakeAwayShown={true} {...this.props} />
  }
}


class WorkingMethod extends React.PureComponent<MethodProps> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    project: PropTypes.shape({
      projectId: PropTypes.string.isRequired,
    }).isRequired,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {style, ...otherProps} = this.props
    const displayCardStyle = isMobileVersion ? {
      marginTop: 10,
    } : {
      borderLeft: `3px solid ${colors.MODAL_PROJECT_GREY}`,
      margin: '10px 0 0 20px',
      padding: '10px 0 10px 30px',
    }
    const cardStyle = {
      ...displayCardStyle,
      fontSize: 13,
    }
    return <div style={style}>
      <MethodHeader {...otherProps} />
      <div style={cardStyle}><AdviceCard {...otherProps} /></div>
    </div>
  }
}


interface AdvicePictoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  adviceId: string
  shouldBeNew?: boolean
}


interface AdvicePictoState {
  adviceId?: string
  pictoSrc?: string
}


class AdvicePicto extends React.PureComponent<AdvicePictoProps, AdvicePictoState> {
  public static propTypes = {
    adviceId: PropTypes.string.isRequired,
    shouldBeNew: PropTypes.bool,
    style: PropTypes.object,
  }

  public state: AdvicePictoState = {}

  public static getDerivedStateFromProps({adviceId, shouldBeNew}, prevState): AdvicePictoState {
    if (adviceId === prevState.adviceId) {
      return null
    }
    return {
      adviceId,
      pictoSrc: getAdvicePicto(adviceId, shouldBeNew),
    }
  }

  public render(): React.ReactNode {
    const {pictoSrc} = this.state
    const {adviceId: omittedAdviceId, shouldBeNew: omittedShouldBeNew, ...imgProps} = this.props
    return <img src={pictoSrc} alt="" {...imgProps} />
  }
}


export {AdviceCard, ExpandedAdviceCardContent, ExplorerAdviceCard, AdvicePicto,
  WorkingMethod, ObservationMethod}

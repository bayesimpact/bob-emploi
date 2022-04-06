import * as Sentry from '@sentry/browser'
import type {TFunction} from 'i18next'
import _memoize from 'lodash/memoize'
import React, {useCallback, useEffect, useMemo, useRef} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import useMedia from 'hooks/media'
import useOnScreen from 'hooks/on_screen'
import type {RootState} from 'store/actions'
import {advicePageIsShown, exploreAdvice, seeAdvice, useDispatch} from 'store/actions'
import {getAdviceModule, getAdviceTitle} from 'store/advice'
import {upperFirstLetter} from 'store/french'
import isMobileVersion from 'store/mobile'

import constructionImage from 'images/construction-picto.svg'
import defaultPicto from 'images/default-picto.svg'
import AlphaTag from 'components/alpha_tag'
import RocketChain from 'components/rocket_chain'
import StringJoiner from 'components/string_joiner'
import TipsList from 'components/tips_list'

import type {CardProps, WithAdvice} from './advisor/base'
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
import ExploreSafeJobs from './advisor/explore_safe_jobs'
import FollowUp from './advisor/follow_up'
import FromServer from './advisor/from_server'
import Immersion from './advisor/immersion'
import ImmersionMilo from './advisor/immersion_milo'
import ImproveInterview from './advisor/improve_interview'
import ImproveResume from './advisor/improve_resume'
import JobBoards from './advisor/job_boards'
import Jobflix from './advisor/jobflix'
import LessApplications from './advisor/less_applications'
import LifeBalance from './advisor/life_balance'
import LongTermMom from './advisor/long_term_mom'
import MotivationEmail from './advisor/motivation_email'
import Needs from './advisor/needs'
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
  ExpandedAdviceCardContent: React.ComponentType<CardProps>
  Picto: string
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
  'explore-safe-jobs': ExploreSafeJobs,
  'find-a-jobboard': JobBoards,
  'follow-up': FollowUp,
  'fresh-resume': ImproveResume,
  'immersion': Immersion,
  'immersion-milo': ImmersionMilo,
  'improve-interview': ImproveInterview,
  'improve-resume': ImproveResume,
  'jobflix': Jobflix,
  'less-applications': LessApplications,
  'life-balance': LifeBalance,
  'long-term-mom': LongTermMom,
  'motivation-email': MotivationEmail,
  'needs-for-handicap': Needs,
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


function getAdvicePicto(adviceId: string): string {
  const module = ADVICE_MODULES[adviceId] || null
  if (module && !module.Picto && Sentry.captureMessage && !missingPicto.has(adviceId)) {
    Sentry.captureMessage(`Picto is missing for "${adviceId}".`)
    missingPicto.add(adviceId)
  }
  return module?.Picto || defaultPicto
}


interface AdviceCardProps extends WithAdvice {
  'aria-live'?: 'polite'
  areTipsShown?: boolean
  onShow?: () => void
  style?: React.CSSProperties
}


const AdviceCardBase: React.FC<AdviceCardProps> = (props: AdviceCardProps): React.ReactElement => {
  const {'aria-live': ariaLive, advice, areTipsShown, onShow, project, style} = props
  const isForPrint = useMedia() === 'print'
  const dispatch = useDispatch()
  useEffect((): void => {
    dispatch(advicePageIsShown(project, advice))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advice.adviceId, dispatch, project.projectId])
  const handleVisibilityChange = useCallback((isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    dispatch(seeAdvice(project, advice))
    onShow?.()
  }, [advice, dispatch, project, onShow])
  const sectionRef = useRef<HTMLElement>(null)
  useOnScreen(sectionRef, {
    isActive: !isForPrint,
    isForAppearing: true,
    minTopValue: 10,
    onChange: handleVisibilityChange,
  })
  return <div style={style} id={advice.adviceId} aria-live={ariaLive}>
    <section ref={sectionRef}>
      {/* TODO(cyrille): Enforce the fontSize somehow, since the Component does not
        expect a style prop. */}
      <ExpandedAdviceCardContent style={{fontSize: 16}} {...props} />
      {areTipsShown ? <TipsList {...{advice, project}} /> : null}
    </section>
  </div>
}
const AdviceCard = React.memo(AdviceCardBase)


export interface ExplorerAdviceCardConfig extends ExpandedAdviceCardProps {
  howToSeeMore?: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
}


const ExplorerLeftPanelBase: React.FC<ExplorerAdviceCardConfig> = (props: ExplorerAdviceCardConfig):
React.ReactElement => {
  const {advice, howToSeeMore, onClick} = props
  const {howToSeeMore: omittedHowToSeeMore, style, ...otherProps} = props
  const {t} = useTranslation()
  const title = getAdviceTitle(advice, t)
  const {staticExplanations = []} = getAdviceModule(advice.adviceId, t) || {}
  const allExplanations = [...(staticExplanations || []), ...(advice.explanations || [])]
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
    background: 'none',
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
        {allExplanations.map((explanation, index): React.ReactElement => <span
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
    <button style={selectForMoreStyle} onClick={onClick} type="button">
      {howToSeeMore}
    </button>
  </div>
}
const ExplorerLeftPanel = React.memo(ExplorerLeftPanelBase)

const ExplorerRightPanelBase: React.FC<ExplorerAdviceCardConfig> =
(props: ExplorerAdviceCardConfig): React.ReactElement|null => {
  const {advice: {adviceId, numStars}, style} = props
  const {t} = useTranslation()
  const {userGainCallout = undefined, userGainDetails = undefined} = getAdviceModule(adviceId, t)
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
    textAlign: 'center',
    ...style,
  }
  const titleStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
  const rocketsStyle: React.CSSProperties = {
    marginTop: 30,
    ...titleStyle,
  }
  const userGainStyle: React.CSSProperties|undefined = isMobileVersion ? {
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
      <RocketChain numStars={numStars || 0} rocketHeight={20} />
    </div>}
    <div style={{flex: 1}} />
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
    <div style={{flex: 1}} />
  </div>
}
const ExplorerRightPanel = React.memo(ExplorerRightPanelBase)

const ExplorerAdviceCardBase: React.FC<ExplorerAdviceCardConfig> =
(props: ExplorerAdviceCardConfig): React.ReactElement => {
  const {style} = props
  const containerStyle: React.CSSProperties = {
    boxShadow: '0 10px 30px rgba(0, 0, 0, .2)',
    display: 'flex',
    flexDirection: isMobileVersion ? 'column' : 'row',
    position: 'relative',
    ...style,
  }
  return <div style={containerStyle}>
    <ExplorerLeftPanel {...props} style={{flex: 3}} />
    <ExplorerRightPanel {...props} style={{flex: 1}} />
  </div>
}
const ExplorerAdviceCard = React.memo(ExplorerAdviceCardBase)

export interface ExpandedAdviceCardProps extends WithAdvice {
  backgroundColor?: string | number
  style?: React.CSSProperties
}


interface GenericExpandedAdviceProps {
  profile: bayes.bob.UserProfile
  style?: React.CSSProperties
  t: TFunction
}


const GenericExpandedAdviceBase: React.FC<GenericExpandedAdviceProps> =
({profile: {gender}, style, t}: GenericExpandedAdviceProps): React.ReactElement => {
  const containerStyle = {
    alignItems: 'center',
    display: 'flex',
    ...style,
  }
  return <div style={containerStyle}>
    <div style={{flex: 1, textAlign: 'center'}}>
      <img src={constructionImage} alt="" />
      <div style={{fontStyle: 'italic', fontWeight: 500}}>
        {t('Module en construction')}
      </div>
    </div>

    <div style={{flex: 2}}>
      <p>{t(
        'Vous serez notifié·e lorsque le module sera prêt pour vous aider à avancer sur ce sujet.',
        {context: gender},
      )}</p>
    </div>
  </div>
}
const GenericExpandedAdvice = React.memo(GenericExpandedAdviceBase)


// TODO(pascal): Add a visual marker if this advice is only shown to alpha users.
const ExpandedAdviceCardContentBase: React.FC<ExpandedAdviceCardProps> =
(props: ExpandedAdviceCardProps): React.ReactElement => {
  const {advice, project, style} = props
  const {t} = useTranslation('advisor')
  const profile = useSelector(({user}: RootState) => user.profile || {})
  const dispatch = useDispatch()
  const handleExplore = useMemo(() => _memoize((visualElement: string): (() => void) =>
    (): void => {
      dispatch(exploreAdvice(project, advice, visualElement))
    }), [advice, dispatch, project])
  const pageProps = {...props, dispatch, handleExplore, profile, t}
  const PageComponent = ADVICE_MODULES[advice.adviceId]?.ExpandedAdviceCardContent || null
  if (PageComponent) {
    return <PageComponent {...pageProps} />
  }
  return <GenericExpandedAdvice {...{profile, style, t}} />
}
const ExpandedAdviceCardContent = React.memo(ExpandedAdviceCardContentBase)


interface MethodHeaderProps {
  advice: bayes.bob.Advice & {adviceId: string}
  project: bayes.bob.Project
  style?: React.CSSProperties
  title?: string
}


const MethodHeaderBase: React.FC<MethodHeaderProps> =
(props: MethodHeaderProps): React.ReactElement => {
  const {advice, advice: {adviceId, isForAlphaOnly, numStars}, style, title} = props
  const {t} = useTranslation('advisor')
  const hasStrongImpact = numStars && numStars > 2
  const containerStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexDirection: isMobileVersion ? 'row-reverse' : 'row',
    ...style,
  }
  const impactStyle = useMemo((): React.CSSProperties => ({
    color: hasStrongImpact ? colors.GREENISH_TEAL : colors.SQUASH,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }), [hasStrongImpact])
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
  const shownTitle = upperFirstLetter(title || getAdviceTitle(advice, t))
  const impact = hasStrongImpact ? t('Fort impact') : t('Impact moyen')
  return <header style={containerStyle}>
    <AdvicePicto adviceId={adviceId} style={pictoStyle} />
    <div style={{flex: 1, margin: '0 15'}}>
      <div style={titleStyle}>
        {shownTitle}
        {isForAlphaOnly ? <AlphaTag style={{marginLeft: 10}} /> : null}
      </div>
      {isMobileVersion ? null : <div style={impactStyle}>{impact}</div>}
    </div>
  </header>
}
const MethodHeader = React.memo(MethodHeaderBase)


interface MethodProps extends MethodHeaderProps, WithAdvice {
  style?: React.CSSProperties
}


// TODO(cyrille): Move out of advisor, we don't need access to the Modules anymore
const WorkingMethodBase: React.FC<MethodProps> = (props: MethodProps): React.ReactElement => {
  const {style, ...otherProps} = props
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
const WorkingMethod = React.memo(WorkingMethodBase)


interface AdvicePictoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  adviceId: string
}


const AdvicePictoBase: React.FC<AdvicePictoProps> =
(props: AdvicePictoProps): React.ReactElement => {
  const {adviceId, ...imgProps} = props
  const pictoSrc = useMemo(() => getAdvicePicto(adviceId), [adviceId])
  return <img src={pictoSrc} alt="" {...imgProps} />
}
const AdvicePicto = React.memo(AdvicePictoBase)


export {AdviceCard, ExpandedAdviceCardContent, ExplorerAdviceCard, AdvicePicto, WorkingMethod}

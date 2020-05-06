import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {connect, useSelector} from 'react-redux'
import {RouteComponentProps, useLocation, useParams, useRouteMatch} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'

import {DispatchAllActions, RootState, diagnosticIsShown,
  diagnosticTalkIsShown} from 'store/actions'
import {prepareT} from 'store/i18n'

import {useFastForward} from 'components/fast_forward'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {JobGroupCoverImage, CircularProgress, SmoothTransitions} from 'components/theme'
import {FEEDBACK_TAB, NEW_PROJECT_ID, Routes} from 'components/url'

import {Diagnostic} from './project/diagnostic'
import {PageWithFeedback} from './project/feedback_bar'
import {PoleEmploiChangelogModal} from './project/pole_emploi'
import {StatisticsPage} from './project/statistics'
import {StrategyPage, StrategyPageParams} from './project/strategy'
import {Workbench} from './project/workbench'


function getProject(pId: string, {projects = []}: bayes.bob.User): bayes.bob.Project {
  const project = projects.find(({projectId}: bayes.bob.Project): boolean => projectId === pId)
  if (project) {
    return project
  }
  if (projects.length) {
    return projects[0]
  }
  return {}
}



const TOTAL_WAITING_TIME_MILLISEC = 8000


const emptyObject = {} as const


const waitingTexts = [
  prepareT('Analyse du marché du travail dans votre région'),
  prepareT('Analyse de votre situation actuelle'),
  prepareT('Évaluation des axes stratégiques prioritaires'),
  prepareT('Préparation des solutions potentielles'),
] as const


interface WaitingProps {
  fadeOutTransitionDurationMillisec?: number
  isForceShown: boolean
  onDone?: () => void
  project: bayes.bob.Project
  style?: React.CSSProperties
  userProfile: bayes.bob.UserProfile
}


const WaitingProjectPageBase = (props: WaitingProps): React.ReactElement => {
  const {fadeOutTransitionDurationMillisec = 600, isForceShown, onDone, project, style,
    userProfile} = props
  const {t, t: translate} = useTranslation()

  const translatedWaitingTexts = useMemo((): readonly string[] => {
    return waitingTexts.map((text: ReturnType<typeof prepareT>): string => translate(text))
  }, [translate])

  const [isFadingOut, setIsFadingOut] = useState(false)
  const [waitingTextIndex, setWaitingTextIndex] = useState(0)
  const haveAllTextBeenShown = waitingTextIndex >= waitingTexts.length
  const waitingText = haveAllTextBeenShown ?
    isForceShown ? t("En attente d'une réponse du serveur") :
      translatedWaitingTexts[waitingTexts.length - 1] : translatedWaitingTexts[waitingTextIndex]

  useEffect((): (() => void)|void => {
    if (haveAllTextBeenShown) {
      return
    }
    const timeout = window.setInterval((): void => {
      setWaitingTextIndex(index => index + 1)
    }, TOTAL_WAITING_TIME_MILLISEC / waitingTexts.length)
    return (): void => {
      clearInterval(timeout)
    }
  }, [haveAllTextBeenShown])

  useEffect((): (() => void)|void => {
    if (!haveAllTextBeenShown) {
      return
    }
    if (!isForceShown) {
      setIsFadingOut(true)
    }
    if (!onDone) {
      return
    }
    const timeout = window.setTimeout(onDone, fadeOutTransitionDurationMillisec)
    return (): void => {
      clearTimeout(timeout)
    }
  }, [fadeOutTransitionDurationMillisec, isForceShown, haveAllTextBeenShown, onDone])

  const containerStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 15,
    position: 'relative',
    zIndex: 0,
    ...style,
  }
  const boxStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 10,
    opacity: isFadingOut ? 0 : 1,
    padding: isMobileVersion ? 30 : '50px 100px',
    textAlign: 'center',
    ...SmoothTransitions,
  }
  const headerStyle: React.CSSProperties = {
    fontSize: 23,
    fontWeight: 500,
  }
  const waitingNoticeStyle: React.CSSProperties = {
    color: colors.BOB_BLUE,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.5,
  }
  const {targetJob: {jobGroup: {romeId = undefined} = {}} = {}} = project
  useFastForward(onDone)
  return <div style={containerStyle}>
    {romeId ? <JobGroupCoverImage romeId={romeId} style={{zIndex: -1}} /> : null}
    <div style={boxStyle}>
      <header style={headerStyle}>{project.title}</header>
      <Trans style={{margin: 'auto', maxWidth: 360, paddingTop: 23}}>
        Merci {{firstName: userProfile.name}} pour votre patience&nbsp;!<br /><br />
        Nous analysons vos informations pour créer votre diagnostic personnalisé.
      </Trans>
      <div style={{padding: 30}}>
        <CircularProgress style={{color: waitingNoticeStyle.color}} />
      </div>
      <div style={waitingNoticeStyle}>
        {waitingText}…
      </div>
    </div>
  </div>
}
WaitingProjectPageBase.propTypes = {
  fadeOutTransitionDurationMillisec: PropTypes.number,
  isForceShown: PropTypes.bool,
  onDone: PropTypes.func,
  project: PropTypes.object.isRequired,
  style: PropTypes.object,
  userProfile: PropTypes.object.isRequired,
}
const WaitingProjectPage = React.memo(WaitingProjectPageBase)


const ProjectPageBase = (): React.ReactElement => {
  const {hash, search} = useLocation()
  const {isExact = false, url = ''} = useRouteMatch(Routes.PROJECT_PATH) || {}
  const user = useSelector(({user}: RootState): bayes.bob.User => user)
  const {projectId = ''} = useParams<{projectId?: string}>()
  const project = getProject(projectId, user)

  const [isFirstTime, setIsFirstTime] = useState(projectId === NEW_PROJECT_ID)

  const [isWaitingInterstitialShown, setIsWaitingInterstitialShown] = useState(isFirstTime)
  const hideWaitingInterstitial = useCallback((): void => setIsWaitingInterstitialShown(false), [])

  useEffect((): void => {
    if (!isExact) {
      // Disable isFirstTime once the URL changes to a sub page.
      setIsFirstTime(false)
    }
  }, [isExact])

  const renderStrategy = useCallback(
    (props: RouteComponentProps<StrategyPageParams>): React.ReactNode => {
      const {match: {params: {strategyId}}} = props
      const {advices = [], strategies = []} = project
      const strategyIndex =
        strategies.findIndex(({strategyId: sId}): boolean => strategyId === sId)
      if (strategyIndex >= 0) {
        const strategy = strategies[strategyIndex] as bayes.bob.Strategy & {strategyId: string}
        return <StrategyPage
          {...props}
          projectUrl={url} project={project}
          strategyUrl={`${url}/${strategyId}`} strategy={strategy}
          strategyRank={strategyIndex + 1} />
      }
      const isAdvice = advices.some(({adviceId}): boolean =>
        adviceId && strategyId && adviceId.startsWith(strategyId) || false)
      if (isAdvice) {
        // Redirect to get a fake strategy (named 'conseil') as well.
        return <Redirect to={`${url}/conseil/${strategyId}{search}{hash}`} />
      }
      // We're lost, redirect to diagnostic.
      return <Redirect to={`${url}${search}${hash}`} />
    },
    [project, hash, search, url],
  )

  const renderAdvice = useCallback(
    (props: RouteComponentProps<StrategyPageParams>): React.ReactNode => {
      const {advices = []} = project
      const {match: {params: {adviceId: aId}}} = props
      const isAdvice = advices.some(({adviceId}): boolean =>
        adviceId && aId && adviceId.startsWith(aId) || false)
      if (!isAdvice) {
        return renderStrategy(props)
      }
      return <Workbench {...props} baseUrl={url} project={project} />
    },
    [project, renderStrategy, url],
  )

  if (project.projectId && project.projectId !== projectId) {
    return <Redirect to={Routes.PROJECT_PAGE + '/' + project.projectId + search + hash} />
  }

  const isPageReady = !!(project.advices || project.diagnostic)
  if (isWaitingInterstitialShown || !isPageReady) {
    return <WaitingProjectPage
      userProfile={user.profile || emptyObject}
      style={{flex: 1}} project={project}
      onDone={hideWaitingInterstitial} isForceShown={!isPageReady} />
  }

  return <Switch>
    <Route path={`${Routes.PROJECT_PATH}/${FEEDBACK_TAB}`}>
      <ProjectDashboardPage project={project} baseUrl={url} isFirstTime={isFirstTime} />
    </Route>
    <Route path={Routes.STATS_PATH}>
      <StatisticsPage baseUrl={url} project={project} />
    </Route>
    <Route path={Routes.ADVICE_PATH} render={renderAdvice} />
    <Route path={Routes.STRATEGY_PATH} render={renderStrategy} />
    <Route path={Routes.PROJECT_PATH} exact={true}>
      <ProjectDashboardPage project={project} baseUrl={url} isFirstTime={isFirstTime} />
    </Route>
    <Redirect to={`${url}${search}${hash}`} />
  </Switch>
}
export default React.memo(ProjectPageBase)


interface DashboardProps {
  baseUrl: string
  isFirstTime: boolean
  project: bayes.bob.Project
}


// TODO(cyrille): Merge back in project page.
const ProjectDashboardPageBase = (props: DashboardProps): React.ReactElement => {
  const {baseUrl, isFirstTime, project} = props

  const makeAdviceLink = useCallback((adviceId: string, strategyId: string): string => {
    return strategyId ? `${baseUrl}/${strategyId}/${adviceId}` : `${baseUrl}/conseil/${adviceId}`
  }, [baseUrl])

  const makeStrategyLink = useCallback(
    (strategyId: string): string => `${baseUrl}/${strategyId}`,
    [baseUrl],
  )

  return <DiagnosticPage
    makeAdviceLink={makeAdviceLink} makeStrategyLink={makeStrategyLink}
    {... {baseUrl, isFirstTime, project}} />
}
ProjectDashboardPageBase.propTypes = {
  baseUrl: PropTypes.string.isRequired,
  isFirstTime: PropTypes.bool,
  project: PropTypes.object.isRequired,
}
const ProjectDashboardPage = React.memo(ProjectDashboardPageBase)


interface DiagnosticConnectedProps {
  featuresEnabled: bayes.bob.Features
  profile: bayes.bob.UserProfile
}


interface DiagnosticPageConfig {
  canShowShareBob?: boolean
  project: bayes.bob.Project
}


interface DiagnosticProps extends DiagnosticConnectedProps, DiagnosticPageConfig {
  dispatch: DispatchAllActions
  baseUrl: string
  isFirstTime?: boolean
  makeAdviceLink: (adviceId: string, strategyId: string) => string
  makeStrategyLink: (strategyId: string) => string
}


const DiagnosticPageBase = (props: DiagnosticProps): React.ReactElement => {
  const {
    baseUrl,
    dispatch,
    featuresEnabled: {poleEmploi},
    isFirstTime,
    makeAdviceLink,
    makeStrategyLink,
    profile,
    project,
  } = props
  const {t} = useTranslation()
  const [isPoleEmploiChangelogShown, setIsPoleEmploiChangelogShown] = useState(!!poleEmploi)

  const handleFullDiagnosticShown = useCallback((): void => {
    // The result of diagnosticIsShown can be two kinds of action (thunk or not), and dispatch
    // accepts both but Typescript gets lost in the process.
    // @ts-ignore
    dispatch(diagnosticIsShown(project))
  }, [dispatch, project])

  const hidePoleEmploiChangelog = useCallback((): void => setIsPoleEmploiChangelogShown(false), [])

  const handleDiagnosticTextShown = useCallback((): void => {
    dispatch(diagnosticTalkIsShown(project))
  }, [dispatch, project])

  const {advices, createdAt, diagnostic, strategies} = project
  const diagnosticStyle = {
    backgroundColor: '#fff',
    flex: 1,
    margin: '0 auto',
    maxWidth: 1000,
    minWidth: isMobileVersion ? '100%' : 680,
  }
  const pageStyle: React.CSSProperties = {
    backgroundColor: !isMobileVersion ? colors.MODAL_PROJECT_GREY :
      '#fff',
    display: 'flex',
    flexDirection: 'column',
  }
  return <PageWithNavigationBar
    page="project"
    navBarContent={t('Mon diagnostic')}
    isChatButtonShown={true} style={pageStyle}>
    <PageWithFeedback project={project} baseUrl={baseUrl}>
      <PoleEmploiChangelogModal
        isShown={isPoleEmploiChangelogShown} projectCreatedAt={createdAt || ''}
        onClose={hidePoleEmploiChangelog} />
      <Diagnostic
        diagnosticData={diagnostic || emptyObject}
        onFullDiagnosticShown={handleFullDiagnosticShown}
        onDiagnosticTextShown={handleDiagnosticTextShown}
        userName={profile.name}
        style={diagnosticStyle}
        {...{advices, baseUrl, isFirstTime, makeAdviceLink,
          makeStrategyLink, project, strategies}}
      />
    </PageWithFeedback>
  </PageWithNavigationBar>
}
DiagnosticPageBase.propTypes = {
  baseUrl: PropTypes.string.isRequired,
  dispatch: PropTypes.func.isRequired,
  featuresEnabled: PropTypes.shape({
    alpha: PropTypes.bool,
    poleEmploi: PropTypes.bool,
    stratOne: PropTypes.oneOf(['ACTIVE', 'CONTROL']),
  }).isRequired,
  isFirstTime: PropTypes.bool,
  makeAdviceLink: PropTypes.func.isRequired,
  makeStrategyLink: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    name: PropTypes.string,
  }).isRequired,
  project: PropTypes.shape({
    advices: PropTypes.array,
    diagnostic: PropTypes.object,
    feedback: PropTypes.shape({
      score: PropTypes.number,
    }),
  }).isRequired,
}
const DiagnosticPage = connect(({user}: RootState): DiagnosticConnectedProps => ({
  featuresEnabled: user.featuresEnabled || {},
  profile: user.profile || {},
}))(React.memo(DiagnosticPageBase))

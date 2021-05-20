import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {RouteComponentProps, useLocation, useParams, useRouteMatch} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'

import {DispatchAllActions, RootState, diagnosticIsShown,
  diagnosticTalkIsShown} from 'store/actions'
import {useAlwaysConvincePage} from 'store/user'

import isMobileVersion from 'store/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {ACHIEVEMENTS_PAGE, CONVINCE_PAGE, FEEDBACK_TAB, NEW_PROJECT_ID, STRAT_PREVIEW_PAGE,
  Routes} from 'components/url'

import AchievementsPage from './project/achievements'
import ConvincePage from './project/convince'
import {Diagnostic} from './project/diagnostic'
import {PageWithFeedback} from './project/feedback_bar'
import {StatisticsPage} from './project/statistics'
import {StrategyPage, StrategyPageParams} from './project/strategy'
import StrategiesPreviewPage from './project/strategies_preview'
import Workbench from './project/workbench'
import WaitingProjectPage from './waiting'


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

const emptyObject = {} as const

const ProjectPageBase = (): React.ReactElement => {
  const {hash, search} = useLocation()
  const {isExact = false, url = ''} = useRouteMatch(Routes.PROJECT_PATH) || {}
  const user = useSelector(({user}: RootState): bayes.bob.User => user)
  const {projectId = ''} = useParams<{projectId?: string}>()
  const project = getProject(projectId, user)

  const isConvincePageEnabled = useAlwaysConvincePage()
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

  const makeAdviceLink = useCallback((adviceId: string, strategyId: string): string => {
    return strategyId ? `${url}/${strategyId}/${adviceId}` : `${url}/conseil/${adviceId}`
  }, [url])

  const makeStrategyLink = useCallback(
    (strategyId: string): string => `${url}/${strategyId}`,
    [url],
  )

  const isPageReady = !!(project.advices || project.diagnostic)
  if (isWaitingInterstitialShown || !isPageReady) {
    return <WaitingProjectPage project={project} onDone={hideWaitingInterstitial} />
  }

  if (project.projectId && project.projectId !== projectId) {
    return <Redirect to={Routes.PROJECT_PAGE + '/' + project.projectId + search + hash} />
  }

  const {
    achievements: hasReviewedAchievements = false,
    mainChallenge: hasReviewedMainChallenge = false,
    strategiesPreview: hasPreviewedStrategies = false,
  } = project.userHasReviewed || {}

  const redirectUrl = isConvincePageEnabled ?
    hasReviewedAchievements ?
      hasReviewedMainChallenge ?
        hasPreviewedStrategies ? url : `${url}/${STRAT_PREVIEW_PAGE}` :
        `${url}/${CONVINCE_PAGE}` :
      `${url}/${ACHIEVEMENTS_PAGE}` :
    url

  const diagnosticPage = <DiagnosticPage
    project={project} baseUrl={url} isFirstTime={isFirstTime && !isConvincePageEnabled}
    makeAdviceLink={makeAdviceLink} makeStrategyLink={makeStrategyLink} />

  return <Switch>
    {isConvincePageEnabled ? <Route path={`${Routes.PROJECT_PATH}/${ACHIEVEMENTS_PAGE}`}>
      <AchievementsPage project={project} baseUrl={url} />
    </Route> : undefined}
    {isConvincePageEnabled && hasReviewedAchievements ? <Route
      path={`${Routes.PROJECT_PATH}/${CONVINCE_PAGE}`}>
      <ConvincePage project={project} baseUrl={url} />
    </Route> : undefined}
    {isConvincePageEnabled && hasReviewedMainChallenge ? <Route
      path={`${Routes.PROJECT_PATH}/${STRAT_PREVIEW_PAGE}`}>
      <StrategiesPreviewPage project={project} baseUrl={url} />
    </Route> : undefined}

    <Route path={`${Routes.PROJECT_PATH}/${FEEDBACK_TAB}`}>
      {diagnosticPage}
    </Route>
    <Route path={Routes.STATS_PATH}>
      <StatisticsPage baseUrl={url} project={project} />
    </Route>
    <Route path={Routes.ADVICE_PATH} render={renderAdvice} />
    <Route path={Routes.STRATEGY_PATH} render={renderStrategy} />

    {!isConvincePageEnabled || hasPreviewedStrategies ? <Route
      path={Routes.PROJECT_PATH} exact={true}>
      {diagnosticPage}
    </Route> : undefined}

    <Redirect to={`${redirectUrl}${search}${hash}`} />
  </Switch>
}
export default React.memo(ProjectPageBase)


interface DiagnosticProps {
  baseUrl: string
  canShowShareBob?: boolean
  isFirstTime?: boolean
  makeAdviceLink: (adviceId: string, strategyId: string) => string
  makeStrategyLink: (strategyId: string) => string
  project: bayes.bob.Project
}


const DiagnosticPageBase = (props: DiagnosticProps): React.ReactElement => {
  const {
    baseUrl,
    isFirstTime,
    makeAdviceLink,
    makeStrategyLink,
    project,
  } = props
  const dispatch = useDispatch<DispatchAllActions>()
  const {t} = useTranslation()
  const isConvincePageEnabled = useAlwaysConvincePage()
  const profile = useSelector(
    ({user}: RootState): bayes.bob.UserProfile => user.profile || emptyObject,
  )
  const handleFullDiagnosticShown = useCallback((): void => {
    // The result of diagnosticIsShown can be two kinds of action (thunk or not), and dispatch
    // accepts both but Typescript gets lost in the process.
    // @ts-ignore
    dispatch(diagnosticIsShown(project))
  }, [dispatch, project])

  const handleDiagnosticTextShown = useCallback((): void => {
    dispatch(diagnosticTalkIsShown(project))
  }, [dispatch, project])

  const {advices, diagnostic, strategies} = project
  const diagnosticStyle = {
    backgroundColor: '#fff',
    flex: 1,
    margin: '0 auto',
    maxWidth: 1000,
    minWidth: isMobileVersion ? '100%' : 680,
  }
  const pageStyle: React.CSSProperties = {
    backgroundColor: !isMobileVersion ?
      isConvincePageEnabled ? colors.PALE_GREY : colors.MODAL_PROJECT_GREY :
      '#fff',
    display: 'flex',
    flexDirection: 'column',
  }
  const diagnosticElement: React.ReactNode = <Diagnostic
    diagnosticData={diagnostic || emptyObject}
    onFullDiagnosticShown={handleFullDiagnosticShown}
    onDiagnosticTextShown={handleDiagnosticTextShown}
    userName={profile.name}
    style={diagnosticStyle}
    {...{
      advices, baseUrl, isFirstTime, makeAdviceLink,
      makeStrategyLink, project, strategies,
    }}
  />
  return <PageWithNavigationBar
    page="project"
    navBarContent={t('Mon diagnostic')}
    isChatButtonShown={true} style={pageStyle}>
    {isConvincePageEnabled ? diagnosticElement :
      <PageWithFeedback project={project} baseUrl={baseUrl}>
        {diagnosticElement}
      </PageWithFeedback>
    }
  </PageWithNavigationBar>
}
DiagnosticPageBase.propTypes = {
  baseUrl: PropTypes.string.isRequired,
  isFirstTime: PropTypes.bool,
  makeAdviceLink: PropTypes.func.isRequired,
  makeStrategyLink: PropTypes.func.isRequired,
  project: PropTypes.shape({
    advices: PropTypes.array,
    createdAt: PropTypes.string,
    diagnostic: PropTypes.object,
    feedback: PropTypes.shape({
      score: PropTypes.number,
    }),
    strategies: PropTypes.arrayOf(PropTypes.shape({
      strategyId: PropTypes.string.isRequired,
    }).isRequired),
  }).isRequired,
}
const DiagnosticPage = React.memo(DiagnosticPageBase)

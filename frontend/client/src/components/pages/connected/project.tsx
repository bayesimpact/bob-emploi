import * as Sentry from '@sentry/browser'
import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import type {RouteComponentProps} from 'react-router'
import {generatePath, useLocation, useParams, useRouteMatch} from 'react-router'
import {Redirect, Route, Switch, useHistory} from 'react-router-dom'

import type {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {useProject} from 'store/project'
import {useActionPlan} from 'store/user'

import {PageWithNavigationBar} from 'components/navigation'
import {ACHIEVEMENTS_PAGE, CONVINCE_PAGE, NEW_PROJECT_ID, STRAT_PREVIEW_PAGE,
  Routes} from 'components/url'

import AchievementsPage from './project/achievements'
import ActionPlanActionPage from './project/action_plan/action'
import ActionPlanActionPreviewPage from './project/action_plan/preview'
import ActionPlanIntroPage from './project/action_plan/intro'
import ActionPlanPage from './project/action_plan/plan'
import ActionPlanRecapPage from './project/action_plan/recap'
import ActionPlanStrategyPage from './project/action_plan/strategy'
import {ConvincePage, isStratsPreviewPageEnabled} from './project/convince'
import {Diagnostic} from './project/diagnostic'
import {StatisticsPage} from './project/statistics'
import type {StrategyPageParams} from './project/strategy'
import {StrategyPage} from './project/strategy'
import StrategiesPreviewPage from './project/strategies_preview'
import Workbench from './project/workbench'
import WaitingProjectPage from './waiting'


const emptyObject = {} as const

const ProjectPageBase = (): React.ReactElement => {
  const {hash, search} = useLocation()
  const history = useHistory()
  const {isExact = false, url = ''} = useRouteMatch(Routes.PROJECT_PATH) || {}
  const {projectId = ''} = useParams<{projectId?: string}>()
  const project = useProject()
  const {advices = [], strategies} = project || {}

  const [isFirstTime, setIsFirstTime] = useState(projectId === NEW_PROJECT_ID)

  const [isWaitingInterstitialShown, setIsWaitingInterstitialShown] = useState(isFirstTime)
  const hideWaitingInterstitial = useCallback((): void => setIsWaitingInterstitialShown(false), [])

  useEffect((): void => {
    if (!isExact) {
      // Disable isFirstTime once the URL changes to a sub page.
      setIsFirstTime(false)
    }
  }, [isExact])

  const onActionPlanIntroNext = useCallback(() => {
    if (!strategies || strategies.length === 0) {
      Sentry.captureMessage(`No strategy found for project "${projectId}".`)
      return
    }
    history.push(generatePath(Routes.ACTION_PLAN_STRAT_PATH, {projectId}))
  }, [history, projectId, strategies])

  const renderStrategy = useCallback(
    (props: RouteComponentProps<StrategyPageParams>): React.ReactNode => {
      const {match: {params: {strategyId}}} = props
      const strategyIndex =
        (strategies || []).findIndex(({strategyId: sId}): boolean => strategyId === sId)
      if (strategies && strategyIndex >= 0) {
        const strategy = strategies[strategyIndex] as bayes.bob.Strategy & {strategyId: string}
        return <StrategyPage
          {...props}
          projectUrl={url} project={project || emptyObject}
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
    [advices, project, hash, search, strategies, url],
  )

  const renderAdvice = useCallback(
    (props: RouteComponentProps<StrategyPageParams>): React.ReactNode => {
      const {advices = []} = project || {}
      const {match: {params: {adviceId: aId}}} = props
      const isAdvice = advices.some(({adviceId}): boolean =>
        adviceId && aId && adviceId.startsWith(aId) || false)
      if (!isAdvice) {
        return renderStrategy(props)
      }
      return <Workbench {...props} baseUrl={url} project={project || {}} />
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
  const isActionPlanEnabled = useActionPlan()
  const hasActionPlan = !!project?.actionPlanStartedAt

  const isPageReady = !!(project?.advices || project?.diagnostic)
  if (isWaitingInterstitialShown || !isPageReady) {
    return <WaitingProjectPage project={project || emptyObject} onDone={hideWaitingInterstitial} />
  }

  if (project?.projectId && project?.projectId !== projectId) {
    return <Redirect to={Routes.PROJECT_PAGE + '/' + project?.projectId + search + hash} />
  }

  const projectWithId = project?.projectId ?
    (project as bayes.bob.Project & {projectId: string}) : undefined

  if (!projectWithId) {
    // This should never happen.
    return <Redirect to={Routes.ROOT} />
  }

  const {
    achievements: hasReviewedAchievements = false,
    mainChallenge: hasReviewedMainChallenge = false,
    strategiesPreview: hasPreviewedStrategies = false,
  } = project.userHasReviewed || {}

  const redirectUrl =
    isActionPlanEnabled ? hasActionPlan ?
      generatePath(Routes.ACTION_PLAN_PLAN_PAGE, {projectId}) :
      generatePath(Routes.ACTION_PLAN_INTRO_PAGE, {projectId}) :
      hasReviewedAchievements ?
        hasReviewedMainChallenge ?
          hasPreviewedStrategies || !isStratsPreviewPageEnabled ? url :
            `${url}/${STRAT_PREVIEW_PAGE}` :
          `${url}/${CONVINCE_PAGE}` :
        `${url}/${ACHIEVEMENTS_PAGE}`

  // TODO(pascal): Clean-up isFirstTime if it's always false.
  const diagnosticPage = <DiagnosticPage
    project={project} baseUrl={url} isFirstTime={false}
    makeAdviceLink={makeAdviceLink} makeStrategyLink={makeStrategyLink} />

  return <Switch>
    <Route path={`${Routes.PROJECT_PATH}/${ACHIEVEMENTS_PAGE}`}>
      <AchievementsPage project={project} baseUrl={url} />
    </Route>
    {hasReviewedAchievements ? <Route
      path={`${Routes.PROJECT_PATH}/${CONVINCE_PAGE}`}>
      <ConvincePage project={project} baseUrl={url} />
    </Route> : undefined}
    {hasReviewedMainChallenge && isStratsPreviewPageEnabled ? <Route
      path={`${Routes.PROJECT_PATH}/${STRAT_PREVIEW_PAGE}`}>
      <StrategiesPreviewPage project={project} baseUrl={url} />
    </Route> : undefined}

    <Route path={Routes.ACTION_PLAN_INTRO_PAGE}>
      <ActionPlanIntroPage onDone={onActionPlanIntroNext} strategies={strategies} />
    </Route>

    <Route path={Routes.ACTION_PLAN_ACTION_PREVIEW_PATH}>
      <ActionPlanActionPreviewPage
        actions={project.actions} baseUrl={url} strategies={strategies} />
    </Route>
    <Route path={Routes.ACTION_PLAN_ACTION_PATH}>
      {isMobileVersion ? <ActionPlanActionPage project={project} baseUrl={url} /> :
        <ActionPlanPage project={projectWithId} />}
    </Route>
    <Route path={Routes.ACTION_PLAN_STRAT_PATH}>
      <ActionPlanStrategyPage project={project} />
    </Route>
    <Route path={Routes.ACTION_PLAN_RECAP_PAGE}>
      <ActionPlanRecapPage project={project} />
    </Route>
    <Route path={Routes.ACTION_PLAN_PLAN_PAGE}>
      <ActionPlanPage project={projectWithId} />
    </Route>

    <Route path={Routes.STATS_PATH}>
      <StatisticsPage baseUrl={url} project={project} />
    </Route>
    <Route path={Routes.ADVICE_PATH} render={renderAdvice} />
    <Route path={Routes.STRATEGY_PATH} render={renderStrategy} />

    {hasPreviewedStrategies || hasReviewedMainChallenge && !isStratsPreviewPageEnabled ? <Route
      path={Routes.PROJECT_PATH} exact={true}>
      {diagnosticPage}
    </Route> : undefined}

    <Route><Redirect to={`${redirectUrl}${search}${hash}`} /></Route>
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
  const {t} = useTranslation()
  const profile = useSelector(
    ({user}: RootState): bayes.bob.UserProfile => user.profile || emptyObject,
  )
  const {advices, diagnostic, strategies} = project
  const diagnosticStyle = {
    backgroundColor: '#fff',
    flex: 1,
    margin: '0 auto',
    maxWidth: 1000,
    minWidth: isMobileVersion ? '100%' : 680,
  }
  const pageStyle: React.CSSProperties = {
    backgroundColor: !isMobileVersion ? colors.PALE_GREY : '#fff',
    display: 'flex',
    flexDirection: 'column',
  }
  return <PageWithNavigationBar
    page="project"
    navBarContent={t('Mon diagnostic')}
    isChatButtonShown={false} style={pageStyle}>
    <Diagnostic
      diagnosticData={diagnostic || emptyObject}
      userName={profile.name}
      style={diagnosticStyle}
      {...{
        advices, baseUrl, isFirstTime, makeAdviceLink,
        makeStrategyLink, project, strategies,
      }}
    />
  </PageWithNavigationBar>
}
const DiagnosticPage = React.memo(DiagnosticPageBase)

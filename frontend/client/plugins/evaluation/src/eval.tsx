import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import i18next from 'i18next'
import _uniqueId from 'lodash/uniqueId'
import {createBrowserHistory} from 'history'
import Storage from 'local-storage-fallback'
import React, {
  Suspense, useCallback, useLayoutEffect, useEffect, useMemo, useRef, useState,
} from 'react'
import type {GoogleLoginResponse, GoogleLoginResponseOffline} from 'react-google-login'
import GoogleLogin from 'react-google-login'
import {useTranslation} from 'react-i18next'
import {connect, Provider, useDispatch, useSelector} from 'react-redux'
import {Route, Switch, useHistory, useLocation, useParams} from 'react-router'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'

import 'normalize.css'
import 'styles/App.css'

import TabNavigationProvider from 'hooks/tab_navigation'

import type {ActionWithId} from 'store/actions'
import {computeActionsForProject, computeAdvicesForProject, getLaborStats, hideToasterMessageAction,
  simulateFocusEmails} from 'store/actions'

import {app, asyncState} from 'store/app_reducer'
import {hasErrorStatus} from 'store/http'
import type {LocalizableString} from 'store/i18n'
import {init as i18nInit, prepareT} from 'store/i18n'
import {parseQueryString} from 'store/parse'
import {createProjectTitle} from 'store/project'
import type {CancelablePromise} from 'store/promise'
import {makeCancelable, useAsynceffect, useSafeDispatch} from 'store/promise'
import createSentryEnhancer from 'store/sentry'

import Button from 'components/button'
import CircularProgress from 'components/circular_progress'
import Trans from 'components/i18n_trans'
import LabeledToggle from 'components/labeled_toggle'
import {useModal} from 'components/modal'
import {SmartLink} from 'components/radium'
import Snackbar from 'components/snackbar'
import Select from 'components/select'
import Textarea from 'components/textarea'
import {SmoothTransitions} from 'components/theme'
import WaitingPage from 'components/pages/waiting'

// TODO(pascal): Move outside of components/page.
import {Strategies} from 'components/pages/connected/project/strategy'

import {ACTIONS_EVAL_PAGE, CONCEPT_EVAL_PAGE, EVAL_PAGE, FEEDBACK_EVAL_PAGE} from './routes'

import ActionsPage, {ActionsPanel} from './components/actions'
import {AdvicesRecap} from './components/advices_recap'
import Assessment from './components/assessment'
import {MainChallengesDistribution, UseCaseSelector} from './components/categories'
import Coaching from './components/coaching'
import CreatePoolModal from './components/create_pool_modal'
import FeedbackPage from './components/feedback'
import PoolOverview from './components/pool_overview'
import {EVAL_SCORES} from './components/score_levels'
import Stats from './components/statistics'
import UseCase from './components/use_case'

import type {AllEvalActions, AuthEvalState, DispatchAllEvalActions,
  EvalRootState} from './store/actions'
import {diagnoseProject, strategizeProject, saveUseCaseEval, getAllMainChallenges,
  createUseCase} from './store/actions'
import {getUseCaseTitle} from './store/eval'
import evalAppReducer from './store/app_reducer'
import {usePools, useUseCases} from './store/selectors'

const emptyArray = [] as const
const emptyObject = {} as const

const OVERVIEW_ID = 'sommaire'
const DIAGNOSTIC_PANEL = 'diagnostic'
const ADVICE_PANEL = 'advice'
const ACTIONS_PANEL = 'actions'
const STRATEGIES_PANEL = 'strategies'
const STATS_PANEL = 'statistics'
const COACHING_PANEL = 'coaching'

type EvalPanel =
  | typeof DIAGNOSTIC_PANEL
  | typeof ADVICE_PANEL
  | typeof ACTIONS_PANEL
  | typeof STRATEGIES_PANEL
  | typeof STATS_PANEL
  | typeof COACHING_PANEL


i18nInit()


interface UseCaseEvalState {
  actions?: readonly ActionWithId[]
  advices?: readonly bayes.bob.Advice[]
  emailsSent?: readonly bayes.bob.EmailSent[]
  diagnostic?: bayes.bob.Diagnostic
  strategies?: readonly bayes.bob.Strategy[]
}


interface EvalPanelConfig {
  name: LocalizableString
  panelId: EvalPanel
  predicate: (state: UseCaseEvalState) => boolean
}


const panels: readonly EvalPanelConfig[] = [
  {
    name: prepareT('Diagnostic'),
    panelId: DIAGNOSTIC_PANEL,
    predicate: ({diagnostic}: UseCaseEvalState): boolean => !!diagnostic,
  },
  {
    name: prepareT('Conseils'),
    panelId: ADVICE_PANEL,
    predicate: ({advices}: UseCaseEvalState): boolean => !!(advices && advices.length),
  },
  {
    name: prepareT('Actions'),
    panelId: ACTIONS_PANEL,
    predicate: ({actions}: UseCaseEvalState): boolean => !!(actions && actions.length),
  },
  {
    name: prepareT('Stratégies'),
    panelId: STRATEGIES_PANEL,
    predicate: ({strategies}: UseCaseEvalState): boolean => !!(strategies && strategies.length),
  },
  {
    name: prepareT('Statistiques'),
    panelId: STATS_PANEL,
    predicate: (): boolean => true,
  },
  {
    name: prepareT('Coaching'),
    panelId: COACHING_PANEL,
    predicate: ({emailsSent}: UseCaseEvalState): boolean => !!(emailsSent && emailsSent.length),
  },
]


interface PanelHeaderLinkProps extends EvalPanelConfig {
  onClick: (panelId: EvalPanel) => void
  panelDomId?: string
  shownPanel?: EvalPanel
  state: UseCaseEvalState
}


const PanelHeaderLinkBase = (props: PanelHeaderLinkProps): React.ReactElement => {
  const {name, onClick, panelDomId, panelId, predicate, shownPanel, state} = props
  const {t: translate} = useTranslation()
  const handleClick = useCallback((): void => onClick(panelId), [onClick, panelId])
  const isAvailable = predicate(state)
  const toggleTitleStyle = {
    ':hover': {
      borderBottom: `2px solid ${colors.BOB_BLUE_HOVER}`,
    },
    'borderBottom': shownPanel === panelId ? `2px solid ${colors.BOB_BLUE}` : 'initial',
    'opacity': isAvailable ? 1 : .5,
    'paddingBottom': 5,
  }
  return <HeaderLink
    onClick={handleClick} isSelected={shownPanel === panelId} style={toggleTitleStyle}
    aria-controls={panelDomId}>
    {translate(...name)}
  </HeaderLink>
}
const PanelHeaderLink = React.memo(PanelHeaderLinkBase)


interface UseCaseEvalProps {
  onSaveEval: (useCase: bayes.bob.UseCase, evaluation: bayes.bob.UseCaseEvaluation) => Promise<void>
  selectNextUseCase: () => void
  useCase?: bayes.bob.UseCase
}


const UseCaseEvalBase = (props: UseCaseEvalProps): React.ReactElement => {
  const {onSaveEval, selectNextUseCase, useCase} = props
  const dispatch = useDispatch<DispatchAllEvalActions>()
  const {t} = useTranslation()

  const [actions, setActions] = useState<readonly ActionWithId[]>(emptyArray)
  const [advices, setAdvices] = useState<readonly bayes.bob.Advice[]>(emptyArray)
  const [mainChallenges, setMainChallenges] =
    useState<readonly bayes.bob.DiagnosticMainChallenge[]>(emptyArray)
  const [coachingEmailFrequency, setCoachingEmailFrequency] =
    useState<bayes.bob.EmailFrequency>('EMAIL_MAXIMUM')
  const [diagnostic, setDiagnostic] = useState<bayes.bob.Diagnostic|undefined>(undefined)
  const [emailsSent, setEmailsSent] = useState<readonly bayes.bob.EmailSent[]>(emptyArray)
  const [evaluation, setEvaluation] = useState<bayes.bob.UseCaseEvaluation>(emptyObject)
  const [isModified, setIsModified] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [jobGroupInfo, setJobGroupInfo] = useState<bayes.bob.JobGroup|undefined>(undefined)
  const [localStats, setLocalStats] = useState<bayes.bob.LocalJobStats|undefined>(undefined)
  const [shownPanel, setShownPanel] = useState<EvalPanel>(DIAGNOSTIC_PANEL)
  const [strategies, setStrategies] = useState<readonly bayes.bob.Strategy[]>(emptyArray)
  const [userCounts, setUserCounts] = useState<bayes.bob.UsersCount|undefined>(undefined)
  const [areAllModulesEnabled, setAreAllModulesEnabled] = useState(false)

  const [isLoadingLaborStats, setIsLoadingLaborStats] = useState(false)
  const [isDiagnosingProject, setIsDiagnosingProject] = useState(false)
  const [isFindingActions, setIsFindingActions] = useState(false)
  const [isAdvisingProject, setIsAdvisingProject] = useState(false)
  const [isStrategizingProject, setIsStrategizingProject] = useState(false)
  const [isSimulatingEmails, setIsSimulatingEmails] = useState(false)

  const localizedUserData = useMemo((): undefined|bayes.bob.User => {
    if (!useCase || !useCase.userData) {
      return undefined
    }
    const {userData} = useCase
    return {
      ...userData,
      profile: {
        ...userData?.profile,
        locale: i18next?.languages?.[0] || config.defaultLang,
      },
      projects: userData?.projects?.map((project) => project.title ? project : {
        ...project,
        title: createProjectTitle(project, t, userData?.profile?.gender),
      }),
    }
  }, [t, useCase])

  useEffect(() => {
    setEmailsSent(emptyArray)
    setIsModified(false)
    setIsSaved(false)
    setEvaluation(useCase?.evaluation || emptyObject)
  }, [dispatch, useCase])

  useAsynceffect(async (checkIfCanceled) => {
    setJobGroupInfo(undefined)
    setLocalStats(undefined)
    setUserCounts(undefined)
    if (!localizedUserData) {
      return
    }
    setIsLoadingLaborStats(true)
    const laborStats = await dispatch(getLaborStats(localizedUserData.projects?.[0] || {}))
    if (checkIfCanceled()) {
      return
    }
    setIsLoadingLaborStats(false)
    if (!laborStats) {
      return
    }
    const {jobGroupInfo, localStats, userCounts} = laborStats
    setJobGroupInfo(jobGroupInfo)
    setLocalStats(localStats)
    setUserCounts(userCounts)
  }, [dispatch, localizedUserData])

  useAsynceffect(async (checkIfCanceled) => {
    setActions(emptyArray)
    setAdvices(emptyArray)
    setDiagnostic(undefined)
    setStrategies(emptyArray)
    if (!localizedUserData) {
      return
    }
    setIsDiagnosingProject(true)
    const diagnostic = await dispatch(diagnoseProject(localizedUserData))
    if (checkIfCanceled()) {
      return
    }
    setIsDiagnosingProject(false)
    // Set diagnostic on state and compute the advice modules.
    if (!diagnostic) {
      return
    }
    setDiagnostic(diagnostic)
    const userWithDiagnostic = {
      ...localizedUserData,
      projects: [{
        ...localizedUserData.projects?.[0],
        diagnostic,
      }],
      ...areAllModulesEnabled && {featuresEnabled: {
        ...localizedUserData.featuresEnabled,
        allModules: true,
      }},
    }
    setIsFindingActions(true)
    const actionsPromise = dispatch(computeActionsForProject(userWithDiagnostic))
    setIsAdvisingProject(true)
    const {advices} = await dispatch(computeAdvicesForProject(userWithDiagnostic)) || {}
    if (checkIfCanceled()) {
      return
    }
    setIsAdvisingProject(false)
    if (!advices) {
      return
    }
    setAdvices(advices)
    const {actions = emptyArray} = await actionsPromise || {}
    if (checkIfCanceled()) {
      return
    }
    setIsFindingActions(false)
    setActions(actions.filter((a): a is ActionWithId => !!a.actionId))
    const userWithAdviceAndDiagnostic = {
      ...localizedUserData,
      projects: [{
        ...localizedUserData.projects?.[0],
        actions,
        advices,
        diagnostic,
      }],
    }
    setIsStrategizingProject(true)
    const {strategies} = await dispatch(strategizeProject(userWithAdviceAndDiagnostic)) || {}
    if (checkIfCanceled()) {
      return
    }
    setIsStrategizingProject(false)
    if (!strategies) {
      return
    }
    setStrategies(strategies)
  }, [dispatch, localizedUserData, areAllModulesEnabled])

  useAsynceffect(async (checkIfCanceled) => {
    setMainChallenges(emptyArray)
    if (!useCase || !useCase.userData) {
      return
    }
    const {categories} = await dispatch(
      getAllMainChallenges({...useCase, userData: localizedUserData})) || {}
    if (!categories || checkIfCanceled()) {
      return
    }
    setMainChallenges(categories)
  }, [dispatch, localizedUserData, useCase])

  useAsynceffect(async (checkIfCanceled) => {
    if (!useCase) {
      return
    }
    const {userData} = useCase
    const userWithAdviceDiagnosticAndStrategies = {
      ...userData,
      profile: {
        ...userData?.profile,
        coachingEmailFrequency,
        locale: i18next?.languages?.[0] || config.defaultLang,
      },
      projects: [{
        ...userData?.projects?.[0],
        advices,
        diagnostic,
        strategies,
      }],
    }

    setIsSimulatingEmails(true)
    const {emailsSent} = await dispatch(
      simulateFocusEmails(userWithAdviceDiagnosticAndStrategies)) || {}
    if (checkIfCanceled()) {
      return
    }
    setIsSimulatingEmails(false)
    if (emailsSent) {
      setEmailsSent(emailsSent)
    }
  }, [dispatch, useCase, advices, coachingEmailFrequency, diagnostic, strategies])

  const state = useMemo((): UseCaseEvalState => ({
    actions,
    advices,
    diagnostic,
    emailsSent,
    strategies,
  }), [actions, advices, diagnostic, emailsSent, strategies])
  const isLoading = {
    [ACTIONS_PANEL]: isFindingActions,
    [ADVICE_PANEL]: isAdvisingProject,
    [COACHING_PANEL]: isSimulatingEmails,
    [DIAGNOSTIC_PANEL]: isDiagnosingProject,
    [STATS_PANEL]: isLoadingLaborStats,
    [STRATEGIES_PANEL]: isStrategizingProject,
  } as const
  const availablePanels = panels.filter(
    ({panelId, predicate}): boolean => isLoading[panelId] || predicate(state))

  const choosePanel = useCallback((wantedPanel?: string): void => {
    const {panelId: nextPanel} =
      availablePanels.find(({panelId}): boolean => panelId === wantedPanel) ||
      availablePanels[0]
    setShownPanel(nextPanel)
  }, [availablePanels])

  const handleRescoreAdvice = useCallback((adviceId: string, newScore: string): void => {
    if (!newScore) {
      const modules: {[key: string]: number} = {...evaluation && evaluation.modules}
      delete modules[adviceId]
      setEvaluation({
        ...evaluation,
        modules,
      })
      return
    }
    setEvaluation({
      ...evaluation,
      modules: {
        ...(evaluation && evaluation.modules),
        [adviceId]: Number.parseInt(newScore, 10),
      },
    })
    setIsModified(true)
  }, [evaluation])

  const handleEvaluateAdvice =
    useCallback((adviceId: string, adviceEvaluation: bayes.bob.AdviceEvaluation): void => {
      const advices = evaluation && evaluation.advices
      setEvaluation({
        ...evaluation,
        advices: {
          ...advices,
          [adviceId]: {
            ...(advices && advices[adviceId]),
            ...adviceEvaluation,
          },
        },
      })
      setIsModified(true)
    }, [evaluation])

  const handleEvaluateDiagnosticSection =
    useCallback((sectionId: string, sectionEvaluation: bayes.bob.GenericEvaluation): void => {
      const diagnostic = evaluation && evaluation.diagnostic
      setEvaluation({
        ...evaluation,
        diagnostic: {
          ...diagnostic,
          [sectionId]: {
            ...(diagnostic && diagnostic[sectionId]),
            ...sectionEvaluation,
          },
        },
      })
      setIsModified(true)
    }, [evaluation])

  const cancelOnChangeRef = useRef<(() => void)[]>([])

  const handleSaveEval = useCallback(async (): Promise<void> => {
    if (!useCase) {
      return
    }
    const get = makeCancelable(onSaveEval(useCase, evaluation))
    cancelOnChangeRef.current?.push(get.cancel)
    await get.promise
    setIsModified(false)
    setIsSaved(true)
  }, [evaluation, onSaveEval, useCase])

  useEffect((): (() => void) => {
    return (): void => {
      for (const cancel of cancelOnChangeRef.current) {
        cancel()
      }
      cancelOnChangeRef.current = []
    }
  }, [useCase])

  const updateEvaluation = useCallback((changes: bayes.bob.UseCaseEvaluation): void => {
    setEvaluation({
      ...evaluation,
      ...changes,
    })
    setIsModified(true)
  }, [evaluation])

  const {profile = emptyObject, projects = emptyArray} = localizedUserData || {}

  const fullProject = useMemo(() => ({
    ...projects?.[0],
    actions,
    advices,
    diagnostic,
    localStats,
    strategies,
  }), [projects, actions, advices, diagnostic, localStats, strategies])

  const user = useMemo(() => ({
    profile,
    projects: [fullProject],
  }), [fullProject, profile])

  const toggleAreAllModulesEnabled = useCallback((): void => {
    setAreAllModulesEnabled((wasEnabled: boolean): boolean => !wasEnabled)
  }, [])
  const allModulesToggle = <LabeledToggle
    isSelected={areAllModulesEnabled} onClick={toggleAreAllModulesEnabled} type="checkbox"
    label={t('Activer tous les modules')} />
  const panelDomId = useMemo(_uniqueId, [])

  const panelContent = ((): React.ReactNode => {
    const isPanelAvailable = !!availablePanels.some(({panelId}): boolean => panelId === shownPanel)
    if (!isPanelAvailable) {
      return null
    }
    switch (shownPanel) {
      case DIAGNOSTIC_PANEL:
        return <Assessment
          diagnostic={diagnostic || emptyObject}
          diagnosticEvaluations={evaluation && evaluation.diagnostic || emptyObject}
          onEvaluateSection={handleEvaluateDiagnosticSection}
          isLoading={isDiagnosingProject}
        />
      case ACTIONS_PANEL:
        return <React.Fragment>
          {allModulesToggle}
          <ActionsPanel project={fullProject} actions={actions} isLoading={isFindingActions} />
        </React.Fragment>
      case ADVICE_PANEL:
        return <React.Fragment>
          {allModulesToggle}
          <AdvicesRecap
            profile={profile} project={fullProject} advices={advices || emptyArray}
            adviceEvaluations={evaluation && evaluation.advices || emptyObject}
            onEvaluateAdvice={handleEvaluateAdvice}
            onRescoreAdvice={handleRescoreAdvice}
            moduleNewScores={evaluation && evaluation.modules || emptyObject}
            isLoading={isAdvisingProject}
          />
        </React.Fragment>
      case STRATEGIES_PANEL:
        if (isStrategizingProject) {
          return <CircularProgress />
        }
        // TODO(cyrille): Make sure we can see what's inside the strategies.
        return <Strategies
          project={fullProject}
          strategies={strategies || emptyArray} />
      case STATS_PANEL:
        return <Stats
          mainChallenges={mainChallenges} project={fullProject} profile={profile}
          jobGroupInfo={jobGroupInfo} userCounts={userCounts}
          isLoading={isLoadingLaborStats} />
      case COACHING_PANEL:
        return <Coaching
          emailsSent={emailsSent || emptyArray}
          coachingEmailFrequency={coachingEmailFrequency}
          onChangeFrequency={setCoachingEmailFrequency}
          user={user} isLoading={isSimulatingEmails} />
    }
  })()

  const toggleStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 34,
  }
  const style: React.CSSProperties = {
    backgroundColor: '#fff',
    flex: 1,
    padding: '25px 30px',
  }
  return <React.Fragment>
    <div style={style}>
      <div style={toggleStyle} role="tablist">
        {panels.map((panel: EvalPanelConfig): React.ReactElement => <PanelHeaderLink
          {...panel} key={panel.panelId} state={state} shownPanel={shownPanel}
          onClick={choosePanel} panelDomId={panelDomId} />)}
      </div>
      <div role="tabpanel" id={panelDomId}>
        {panelContent}
      </div>
    </div>
    <ScorePanel
      evaluation={evaluation}
      isModified={!!isModified}
      isSaved={!!isSaved}
      onSave={handleSaveEval}
      onUpdate={updateEvaluation}
      selectNextUseCase={selectNextUseCase}
      style={{marginTop: 20}} />
  </React.Fragment>
}
const UseCaseEval = React.memo(UseCaseEvalBase)


const emptyUser = {} as const


interface SelectOption {
  name: string
  value: string
}


const UseCaseEvalPageBase = (): React.ReactElement => {
  // Get the use case to display if any.
  const {search} = useLocation()
  const {
    email, ticketId, userId,
  } = parseQueryString(search.slice(1))
  const hasSoleUser = !!(email || userId || ticketId)

  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const history = useHistory()
  const {
    poolName,
    useCaseId,
  } = useParams<{poolName?: string; useCaseId?: string}>()

  const setPoolName = useCallback((poolName?: string): void => {
    if (poolName) {
      history.push(`${EVAL_PAGE}/${poolName}`)
    } else {
      history.push(EVAL_PAGE)
    }
  }, [history])
  const setUseCaseId = useCallback((useCaseId?: string): void => {
    if (useCaseId) {
      history.push(`${EVAL_PAGE}/${poolName}/${useCaseId}`)
    }
  }, [history, poolName])

  const [selectedUseCase, selectUseCase] = useState<bayes.bob.UseCase|undefined>()
  const pools = usePools()
  const useCases = useUseCases(poolName)
  const isOverviewShown = useCaseId === OVERVIEW_ID
  const [isCreatePoolModalShown, showCreatePoolModal, hideCreatePoolModal] = useModal()

  // On first run get the a usecase from email.
  const hasSelectedUseCase = !!selectedUseCase
  useAsynceffect(async (checkIfCanceled) => {
    if (hasSelectedUseCase) {
      return
    }
    if (email || userId || ticketId) {
      const useCase = await dispatch(createUseCase({email, ticketId, userId}))
      if (useCase && !checkIfCanceled()) {
        selectUseCase(useCase)
      }
      return
    }
  }, [dispatch, hasSelectedUseCase, email, ticketId, userId])

  // If we don't have a selected pool, select the first pool when they are loaded.
  const hasPoolName = !!poolName
  useEffect((): void => {
    if (pools && !hasPoolName && !hasSoleUser) {
      setPoolName(pools.length ? pools[0].name : undefined)
    }
  }, [pools, hasPoolName, setPoolName, hasSoleUser])

  // If we don't have a selected user, select the first one when the use cases are loaded.
  const hasUseCaseId = !!useCaseId
  useEffect((): void => {
    if (!hasSoleUser && !hasUseCaseId && useCases.length) {
      setUseCaseId(useCases[0].useCaseId)
    }
  }, [useCases, hasUseCaseId, hasSoleUser, setUseCaseId])

  // Update the selected use case when we change the ID.
  useEffect((): void => {
    if (hasSoleUser) {
      return
    }
    selectUseCase(useCases.find(
      (useCase: bayes.bob.UseCase): boolean => useCase.useCaseId === useCaseId) || undefined)
  }, [useCases, useCaseId, hasSoleUser])

  useLayoutEffect((): void => {
    const {userData = emptyUser} = selectedUseCase || {}
    dispatch({type: 'SELECT_USER', user: userData})
  }, [dispatch, selectedUseCase])

  const selectNextUseCase = useCallback((): void => {
    let nextUseCase: bayes.bob.UseCase|undefined = undefined
    for (const useCase of useCases) {
      const indexInPool = useCase.indexInPool || 0
      if (indexInPool <= (selectedUseCase && selectedUseCase.indexInPool || 0)) {
        continue
      }
      if (!nextUseCase || indexInPool < (nextUseCase && nextUseCase.indexInPool || 0)) {
        nextUseCase = useCase
      }
    }
    if (nextUseCase) {
      setUseCaseId(nextUseCase.useCaseId)
    }
  }, [selectedUseCase, useCases, setUseCaseId])

  const savedEvalRef = useRef<CancelablePromise<unknown>|undefined>()
  // Cancel the aftermath of saving the eval on unmount.
  useEffect((): (() => void) => (): void => savedEvalRef.current?.cancel(), [])
  // Cancel the aftermath of saving the eval if a new use case is selected.
  useEffect((): void => savedEvalRef.current?.cancel(), [selectedUseCase])

  const handleSaveEval = useCallback(
    async (useCase: bayes.bob.UseCase, evaluation: bayes.bob.UseCaseEvaluation): Promise<void> => {
      const {useCaseId} = useCase
      if (!useCaseId) {
        return
      }
      const saveEval = makeCancelable(dispatch(saveUseCaseEval(useCaseId, evaluation, poolName)))
      savedEvalRef.current = saveEval
      await saveEval.promise
      selectNextUseCase()
    }, [dispatch, poolName, selectNextUseCase])

  const handleNewUseCase = useCallback(
    (selectedUseCase: bayes.bob.UseCase, field: string, emailOrId: string): void => {
      hideCreatePoolModal()
      selectUseCase(selectedUseCase)
      if (emailOrId) {
        history.push(`${EVAL_PAGE}?${field}=${encodeURIComponent(emailOrId)}`)
      } else {
        history.replace(EVAL_PAGE)
      }
    },
    [hideCreatePoolModal, history])

  const {t} = useTranslation()
  const poolOptions = (pools || []).
    map(({evaluatedUseCaseCount, name = '', useCaseCount}): SelectOption => {
      const isPoolEvaluated = evaluatedUseCaseCount === useCaseCount
      return {
        name: (isPoolEvaluated ? '✅ ' :
          evaluatedUseCaseCount && evaluatedUseCaseCount >= 10 ? '✓ ' : '🎯 ') + name,
        value: name,
      }
    })
  const overviewOption: SelectOption = useMemo(() => ({
    name: t('Sommaire'),
    value: OVERVIEW_ID,
  } as const), [t])

  const useCasesOptions = useMemo(
    (): SelectOption[] =>
      [overviewOption, ...[...useCases].
        sort((a: bayes.bob.UseCase, b: bayes.bob.UseCase): number =>
          (a.indexInPool || 0) - (b.indexInPool || 0)).
        map(({indexInPool, title, useCaseId, userData, evaluation}): SelectOption => {
          return {
            name: (evaluation ? '✅ ' : '🎯 ') +
              (indexInPool || 0).toString() + ' - ' + getUseCaseTitle(t, title, userData),
            value: useCaseId || '',
          }
        })],
    [overviewOption, t, useCases],
  )
  const centralPanelstyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minWidth: 650,
  }
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    padding: 20,
  }
  const letfBarStyle: React.CSSProperties = {
    display: 'flex',
    flex: isOverviewShown ? 1 : 0,
    flexDirection: 'column',
    marginRight: 20,
    minWidth: 400,
    padding: 5,
  }
  return <div style={style}>
    <CreatePoolModal
      isShown={isCreatePoolModalShown}
      onTransientCreated={handleNewUseCase}
      onClose={hideCreatePoolModal} />
    <div style={letfBarStyle}>
      <Select
        options={poolOptions} value={poolName}
        onChange={setPoolName} style={{backgroundColor: '#fff', marginBottom: 5}} />
      <Select
        options={useCasesOptions} value={useCaseId || undefined}
        onChange={setUseCaseId} style={{backgroundColor: '#fff'}} />
      <div style={{margin: '5px 0 10px', textAlign: 'center'}}>
        <Button onClick={showCreatePoolModal}>
          {t("Créer un cas d'utilisation")}
        </Button>
      </div>
      {selectedUseCase ? <UseCase useCase={selectedUseCase} t={t} /> : null}
      {isOverviewShown && useCases.length ? <PoolOverview
        useCases={useCases} onSelectUseCase={selectUseCase} /> : null}
    </div>
    <div style={centralPanelstyle}>
      {selectedUseCase ? <UseCaseEval
        useCase={selectedUseCase} onSaveEval={handleSaveEval}
        selectNextUseCase={selectNextUseCase} /> : null}
    </div>
  </div>
}
const UseCaseEvalPage = React.memo(UseCaseEvalPageBase)


interface ScoreButtonProps {
  children: React.ReactNode
  image: string
  isSelected: boolean
  onClick: (score: bayes.bob.UseCaseScore) => void
  score: bayes.bob.UseCaseScore
}


const ScoreButtonBase = (props: ScoreButtonProps): React.ReactElement => {
  const {children, image, isSelected, onClick, score} = props
  const handleClick = useCallback((): void => onClick(score), [onClick, score])
  const containerStyle = useMemo((): RadiumCSSProperties => ({
    ':hover': {
      opacity: 1,
    },
    'cursor': 'pointer',
    'display': 'block',
    'fontSize': 13,
    'fontWeight': 500,
    'opacity': isSelected ? 1 : .5,
    'padding': '25px 10px',
    'textAlign': 'center',
  }), [isSelected])
  return <SmartLink style={containerStyle} onClick={handleClick} aria-pressed={isSelected}>
    <img src={image} alt="" style={{paddingBottom: 10}} /><br />
    {children}
  </SmartLink>
}
const ScoreButton = React.memo(ScoreButtonBase)


const conceptEvalPageStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
}


const ConceptEvalPageBase = (): React.ReactElement => <div style={conceptEvalPageStyle}>
  <UseCaseSelector />
  <MainChallengesDistribution style={{maxWidth: 1000}} />
</div>
const ConceptEvalPage = React.memo(ConceptEvalPageBase)


const STORAGE_SIGN_IN_KEY = `${config.productName}-eval-google-sign-in`


const warningStyle: React.CSSProperties = {
  marginBottom: 20,
}
const AuthenticateEvalPageBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllEvalActions>()
  const fetchGoogleIdToken = useSelector(({auth}: EvalRootState) => auth.fetchGoogleIdToken)
  const [authenticationError, setAuthenticationError] = useState('')
  const {t} = useTranslation()

  const handleGoogleFailure = useCallback(
    (error): void => setAuthenticationError(error?.details || JSON.stringify(error)), [])

  const handleGoogleLogin = useCallback(
    async (googleResponse: GoogleLoginResponse|GoogleLoginResponseOffline): Promise<void> => {
      const googleUser = googleResponse as GoogleLoginResponse
      if (!googleUser.getId) {
        throw new Error('Google Login offline response, this should never happen')
      }
      const {id_token: googleIdToken} = await googleUser.getAuthResponse()
      const response = await fetch(
        '/api/eval/authorized', {headers: {Authorization: 'Bearer ' + googleIdToken}})
      if (hasErrorStatus(response)) {
        setAuthenticationError(t(
          "L'utilisateur {{email}} n'a pas été autorisé.",
          {email: googleUser.getBasicProfile().getEmail()}))
        return
      }
      Storage.setItem(STORAGE_SIGN_IN_KEY, '1')
      dispatch({googleUser, type: 'AUTH'})
    },
    [dispatch, t],
  )

  if (fetchGoogleIdToken) {
    return <Switch>
      <Route path={CONCEPT_EVAL_PAGE}>
        <ConceptEvalPage />
      </Route>
      <Route path={ACTIONS_EVAL_PAGE}>
        <ActionsPage />
      </Route>
      <Route path={FEEDBACK_EVAL_PAGE}>
        <FeedbackPage />
      </Route>
      <Route path={`${EVAL_PAGE}/:poolName/:useCaseId?`}>
        <UseCaseEvalPage />
      </Route>
      <Route path={`${EVAL_PAGE}/:poolName?`}>
        <UseCaseEvalPage />
      </Route>
    </Switch>
  }

  return <div style={{padding: 20, textAlign: 'center'}}>
    <Trans parent="p" style={warningStyle}>
      Cette fonctionnalité nécessite l'utilisation de cookies pour fonctionner.<br />En cliquant
      sur "Sign in", vous en acceptez l'utilisation.
    </Trans>
    <GoogleLogin
      clientId={config.googleSSOClientId}
      isSignedIn={!!Storage.getItem(STORAGE_SIGN_IN_KEY)}
      onSuccess={handleGoogleLogin}
      onFailure={handleGoogleFailure} />
    {authenticationError ? <React.Fragment>
      <Trans style={{margin: 20}}>
        L'authentification a échoué. L'accès à cet outil est restreint. <br />
        Contactez nous&nbsp;: contact@bob-emploi.fr
      </Trans>
      <div>{authenticationError}</div>
    </React.Fragment> : null}
  </div>
}
const AuthenticateEvalPage = React.memo(AuthenticateEvalPageBase)



async function fetchGoogleIdToken(googleUser: GoogleLoginResponse): Promise<string> {
  const {'expires_at': expiresAt, 'id_token': idToken} = googleUser.getAuthResponse()
  if (expiresAt > Date.now()) {
    return idToken
  }
  const {id_token: googleIdToken} = await googleUser.reloadAuthResponse()
  return googleIdToken
}


function evalAuthReducer(state: AuthEvalState = {}, action: AllEvalActions): AuthEvalState {
  if (action.type === 'AUTH' && action.googleUser) {
    return {
      ...state,
      fetchGoogleIdToken: (): Promise<string> => fetchGoogleIdToken(action.googleUser),
    }
  }
  return state
}


function evalUserReducer(
  state: bayes.bob.User = emptyUser, action: AllEvalActions): bayes.bob.User {
  if (action.type === 'SELECT_USER') {
    return action.user
  }
  return state
}


const history = createBrowserHistory()

// Enable devTools middleware.
const finalCreateStore = composeWithDevTools(
  applyMiddleware(thunk, routerMiddleware(history)),
  createSentryEnhancer(),
)(createStore)

// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(
  combineReducers({
    app,
    asyncState,
    auth: evalAuthReducer,
    eval: evalAppReducer,
    router: connectRouter(history),
    user: evalUserReducer,
  }),
)
// TODO(pascal): Find a way to do that without module.
// eslint-disable-next-line unicorn/prefer-module
if (module.hot) {
  // eslint-disable-next-line unicorn/prefer-module
  module.hot.accept(['store/app_reducer', './store/app_reducer'], async (): Promise<void> => {
    const {app: newApp, asyncState: newAsyncState} = await import('store/app_reducer')
    const {default: newEvalAppReducer} = await import('./store/app_reducer')
    store.replaceReducer(combineReducers({
      app: newApp,
      asyncState: newAsyncState,
      auth: evalAuthReducer,
      eval: newEvalAppReducer,
      router: connectRouter(history),
      user: evalUserReducer,
    }))
  })
}


interface HeaderLinkProps extends React.HTMLProps<HTMLButtonElement> {
  isSelected?: boolean
  style?: RadiumCSSProperties
}


const HeaderLinkBase = (props: HeaderLinkProps): React.ReactElement => {
  const {children, isSelected, style, ...extraProps} = props
  const containerStyle = useMemo((): RadiumCSSProperties => ({
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: isSelected ? 'bold' : 'initial',
    marginRight: 30,
    textAlign: 'center',
    width: 80,
    ...style,
  }), [isSelected, style])
  return <SmartLink
    role="tab" aria-selected={isSelected} style={containerStyle} {...extraProps} type="button">
    {children}
  </SmartLink>
}
const HeaderLink = React.memo(HeaderLinkBase)


interface ScorePanelProps {
  evaluation: bayes.bob.UseCaseEvaluation
  isModified: boolean
  isSaved: boolean
  onSave: () => void
  onUpdate: (value: bayes.bob.UseCaseEvaluation) => void
  selectNextUseCase: () => void
  style: React.CSSProperties
}


const scorePanelButtonsContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
}

const ScorePanelBase = (props: ScorePanelProps): React.ReactElement => {
  const {
    evaluation: {comments = '', score = ''}, onSave, isSaved, isModified, onUpdate,
    selectNextUseCase, style,
  } = props
  const {t, t: translate} = useTranslation()

  const handleCommentChange = useCallback(
    (comments: string): void => onUpdate({comments}),
    [onUpdate],
  )

  const updateScore = useCallback(
    (score: bayes.bob.UseCaseScore): void => onUpdate({score}),
    [onUpdate],
  )

  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    padding: '30px 30px 0px',
    ...style,
  }), [style])

  const savedMessageStyle = useMemo((): React.CSSProperties => ({
    fontSize: 12,
    opacity: (isSaved && !isModified) ? 1 : 0,
    ...SmoothTransitions,
  }), [isSaved, isModified])

  return <div style={containerStyle}>
    <strong style={{alignSelf: 'flex-start', paddingBottom: 25}}>
      {t('Évaluation')}
    </strong>
    <Textarea
      style={{minHeight: 100, width: '100%'}} value={comments || ''}
      placeholder={t('Commentaires')}
      onChange={handleCommentChange} />
    <div style={scorePanelButtonsContainerStyle}>
      <div style={{display: 'flex'}}>
        {EVAL_SCORES.map((level): React.ReactNode => <ScoreButton
          key={`${level.score}-button`}
          onClick={updateScore}
          isSelected={score === level.score} image={level.image}
          score={level.score}>
          {translate(...level.title)}
        </ScoreButton>)}
      </div>
      <div style={{margin: '10px 0', paddingRight: 10}}>
        {isModified ?
          <Button type="validation" onClick={onSave}>{t('Enregister')}</Button>
          :
          <Button type="navigation" onClick={selectNextUseCase}>{t('Suivant')}</Button>
        }
      </div>
    </div>
    <div style={savedMessageStyle}>
      {t('Évaluation sauvegardée')}
    </div>
  </div>
}
const ScorePanel = React.memo(ScorePanelBase)


const EvalSnackbar = connect(
  ({asyncState}: EvalRootState): {snack?: string} => ({
    snack: asyncState.errorMessage,
  }),
  (dispatch: DispatchAllEvalActions) => ({
    onHide: (): void => void dispatch(hideToasterMessageAction),
  }),
)(Snackbar)


const App = (): React.ReactElement => <Provider store={store}>
  <Suspense fallback={<WaitingPage />}>
    <TabNavigationProvider>
      <div style={{backgroundColor: colors.BACKGROUND_GREY, color: colors.DARK_TWO}}>
        <ConnectedRouter history={history}>
          <Route path={EVAL_PAGE} component={AuthenticateEvalPage} />
        </ConnectedRouter>
        <EvalSnackbar timeoutMillisecs={4000} />
      </div>
    </TabNavigationProvider>
  </Suspense>
</Provider>


export default React.memo(App)

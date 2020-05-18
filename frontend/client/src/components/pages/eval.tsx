import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {createBrowserHistory} from 'history'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React, {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import GoogleLogin, {GoogleLoginResponse, GoogleLoginResponseOffline} from 'react-google-login'
import {useTranslation} from 'react-i18next'
import {connect, Provider, useDispatch} from 'react-redux'
import {Redirect, Route, RouteComponentProps, Switch, useHistory, useLocation,
  useParams} from 'react-router'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'

import {AllEvalActions, AuthEvalState, DispatchAllEvalActions, EvalRootState,
  computeAdvicesForProject, diagnoseProject, getEvalUseCasePools, strategizeProject,
  getEvalUseCases, getLaborStats, getAllCategories, createUseCase, simulateFocusEmails,
  hideToasterMessageAction, noOp} from 'store/actions'

import {app, asyncState} from 'store/app_reducer'
import {getUseCaseTitle} from 'store/eval'
import {init as i18nInit} from 'store/i18n'
import {parseQueryString} from 'store/parse'
import {CancelablePromise, makeCancelable, makeCancelableDispatch,
  useSafeDispatch} from 'store/promise'
import {createSentryMiddleware} from 'store/sentry'

import {useModal} from 'components/modal'
import {RadiumDiv, RadiumSpan} from 'components/radium'
import {Snackbar} from 'components/snackbar'
import {Button, SmoothTransitions, Textarea} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'
import {WaitingPage} from 'components/pages/waiting'
import {Routes} from 'components/url'

import {Strategies} from './connected/project/strategy'
import {AdvicesRecap} from './eval/advices_recap'
import {Assessment} from './eval/assessment'
import {CategoriesDistribution, UseCaseSelector} from './eval/categories'
import {Coaching} from './eval/coaching'
import {CreatePoolModal} from './eval/create_pool_modal'
import {PoolOverview} from './eval/overview'
import {EVAL_SCORES} from './eval/score_levels'
import {Stats} from './eval/statistics'
import {UseCase} from './eval/use_case'

require('normalize.css')
require('styles/App.css')

const emptyArray = [] as const
const emptyObject = {} as const

const OVERVIEW_ID = 'sommaire'
const DIAGNOSTIC_PANEL = 'diagnostic'
const ADVICE_PANEL = 'advice'
const STRATEGIES_PANEL = 'strategies'
const STATS_PANEL = 'statistics'
const COACHING_PANEL = 'coaching'

type EvalPanel =
  | typeof DIAGNOSTIC_PANEL
  | typeof ADVICE_PANEL
  | typeof STRATEGIES_PANEL
  | typeof STATS_PANEL
  | typeof COACHING_PANEL


i18nInit()


interface UseCaseEvalState {
  advices?: readonly bayes.bob.Advice[]
  emailsSent?: readonly bayes.bob.EmailSent[]
  diagnostic?: bayes.bob.Diagnostic
  strategies?: readonly bayes.bob.Strategy[]
}


interface EvalPanelConfig {
  name: string
  panelId: EvalPanel
  predicate: (state: UseCaseEvalState) => boolean
}


const panels: readonly EvalPanelConfig[] = [
  {
    name: 'Diagnostic',
    panelId: DIAGNOSTIC_PANEL,
    predicate: ({diagnostic}: UseCaseEvalState): boolean => !!diagnostic,
  },
  {
    name: 'Conseils',
    panelId: ADVICE_PANEL,
    predicate: ({advices}: UseCaseEvalState): boolean => !!(advices && advices.length),
  },
  {
    name: 'Stratégies',
    panelId: STRATEGIES_PANEL,
    predicate: ({strategies}: UseCaseEvalState): boolean => !!(strategies && strategies.length),
  },
  {
    name: 'Statistiques',
    panelId: STATS_PANEL,
    predicate: (): boolean => true,
  },
  {
    name: 'Coaching',
    panelId: COACHING_PANEL,
    predicate: ({emailsSent}: UseCaseEvalState): boolean => !!(emailsSent && emailsSent.length),
  },
]


interface PanelHeaderLinkProps extends EvalPanelConfig {
  onClick: (panelId: EvalPanel) => void
  shownPanel?: EvalPanel
  state: UseCaseEvalState
}


const PanelHeaderLinkBase = (props: PanelHeaderLinkProps): React.ReactElement => {
  const {name, onClick, panelId, predicate, shownPanel, state} = props
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
  return <HeaderLink onClick={handleClick} isSelected={shownPanel === panelId}>
    <RadiumSpan style={toggleTitleStyle}>{name}</RadiumSpan>
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

  const [advices, setAdvices] = useState<readonly bayes.bob.Advice[]>(emptyArray)
  const [categories, setCategories] = useState<readonly bayes.bob.DiagnosticCategory[]>(emptyArray)
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

  useEffect((): (() => void) => {
    setAdvices(emptyArray)
    setCategories(emptyArray)
    setDiagnostic(undefined)
    setEmailsSent(emptyArray)
    setIsModified(false)
    setIsSaved(false)
    setJobGroupInfo(undefined)
    setLocalStats(undefined)
    setStrategies(emptyArray)
    setUserCounts(undefined)
    setEvaluation(useCase?.evaluation || emptyObject)
    if (!useCase || !useCase.userData) {
      return (): void => void 0
    }
    const {userData} = useCase
    const [safeDispatch, cancelPromises] = makeCancelableDispatch(dispatch)

    safeDispatch(getLaborStats(userData)).
      then((laborStats: bayes.bob.LaborStatsData|void): void => {
        if (!laborStats) {
          return
        }
        const {jobGroupInfo, localStats, userCounts} = laborStats
        setJobGroupInfo(jobGroupInfo)
        setLocalStats(localStats)
        setUserCounts(userCounts)
      })

    safeDispatch(getAllCategories(useCase)).
      then((response: bayes.bob.DiagnosticCategories | void): void => {
        if (!response) {
          return
        }
        setCategories(response.categories || emptyArray)
      })

    // Compute the diagnostic.
    safeDispatch(diagnoseProject(userData)).then((diagnostic: bayes.bob.Diagnostic|void): void => {
      // Set diagnostic on state and compute the advice modules.
      if (!diagnostic) {
        return
      }
      setDiagnostic(diagnostic)
      const userWithDiagnostic = {
        ...userData,
        projects: [{
          ...userData.projects?.[0],
          diagnostic,
        }],
      }
      safeDispatch(computeAdvicesForProject(userWithDiagnostic)).
        then((response: bayes.bob.Advices|void): void => {
          if (!response || !response.advices) {
            return
          }
          setAdvices(response.advices)
          const userWithAdviceAndDiagnostic = {
            ...userData,
            projects: [{
              ...userData.projects?.[0],
              advices: response.advices,
              diagnostic,
            }],
          }
          safeDispatch(strategizeProject(userWithAdviceAndDiagnostic)).
            then((response: bayes.bob.Strategies|void): void => {
              if (!response) {
                return
              }
              setStrategies(response.strategies || emptyArray)
            })
        })
    })

    return cancelPromises
  }, [dispatch, useCase])

  useEffect((): (() => void) => {
    if (!useCase) {
      return (): void => void 0
    }
    const {userData} = useCase
    const userWithAdviceDiagnosticAndStrategies = {
      ...userData,
      profile: {
        ...userData?.profile,
        coachingEmailFrequency,
      },
      projects: [{
        ...userData?.projects?.[0],
        advices,
        diagnostic,
        strategies,
      }],
    }
    const get = makeCancelable<bayes.bob.User|void>(dispatch(
      simulateFocusEmails(userWithAdviceDiagnosticAndStrategies)))
    get.promise.then((response: bayes.bob.User|void): void => {
      if (!response || !response.emailsSent) {
        return
      }
      setEmailsSent(response.emailsSent)
    })
    return get.cancel
  }, [dispatch, useCase, advices, coachingEmailFrequency, diagnostic, strategies])

  const state = useMemo((): UseCaseEvalState => ({
    advices,
    diagnostic,
    emailsSent,
    strategies,
  }), [advices, diagnostic, emailsSent, strategies])
  const availablePanels = panels.filter(({predicate}): boolean => predicate(state))

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

  const handleSaveEval = useCallback((): void => {
    if (!useCase) {
      return
    }
    const get = makeCancelable(onSaveEval(useCase, evaluation))
    cancelOnChangeRef.current?.push(get.cancel)
    get.promise.then((): void => {
      setIsModified(false)
      setIsSaved(true)
    })
  }, [evaluation, onSaveEval, useCase])

  useEffect((): (() => void) => {
    return (): void => {
      cancelOnChangeRef.current?.forEach((cancel): void => cancel())
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

  const {userData = undefined} = useCase || {}
  const {profile = {}, projects = []} = userData || {}
  const project = projects && projects.length && projects[0] || {}

  const panelContent = ((): React.ReactNode => {
    const fullProject = {
      ...project,
      advices,
      diagnostic,
      localStats,
      strategies,
    }
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
        />
      case ADVICE_PANEL:
        return <AdvicesRecap
          profile={profile} project={fullProject} advices={advices || emptyArray}
          adviceEvaluations={evaluation && evaluation.advices || emptyObject}
          onEvaluateAdvice={handleEvaluateAdvice}
          onRescoreAdvice={handleRescoreAdvice}
          moduleNewScores={evaluation && evaluation.modules || emptyObject}
        />
      case STRATEGIES_PANEL:
        // TODO(cyrille): Make sure we can see what's inside the strategies.
        return <Strategies
          project={fullProject}
          strategies={strategies || emptyArray} />
      case STATS_PANEL:
        return <Stats
          categories={categories} project={fullProject} profile={profile}
          jobGroupInfo={jobGroupInfo} userCounts={userCounts} />
      case COACHING_PANEL:
        return <Coaching
          project={fullProject} emailsSent={emailsSent || emptyArray}
          coachingEmailFrequency={coachingEmailFrequency}
          onChangeFrequency={setCoachingEmailFrequency} />
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
      <div style={toggleStyle}>
        {panels.map((panel: EvalPanelConfig): React.ReactElement => <PanelHeaderLink
          {...panel} key={panel.panelId} state={state} shownPanel={shownPanel}
          onClick={choosePanel} />)}
      </div>
      {panelContent}
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


interface UseCaseEvalPageProps {
  fetchGoogleIdToken: () => Promise<string>
}


interface SelectOption {
  name: string
  value: string
}


const UseCaseEvalPageBase = (props: UseCaseEvalPageProps): React.ReactElement => {
  const {fetchGoogleIdToken} = props
  const {search} = useLocation()
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const history = useHistory()
  const {useCaseId: locationUseCaseId} = useParams<{useCaseId: string}>()

  const [selectedUseCase, selectUseCase] = useState<bayes.bob.UseCase|undefined>()
  const [pools, setPools] = useState<readonly bayes.bob.UseCasePool[]>([])
  const [poolName, setPoolName] = useState<string|undefined>()
  const [isFirstRun, setIsFirstRun] = useState(true)
  const [useCases, setUseCases] = useState<readonly bayes.bob.UseCase[]>([])
  const [initialUseCaseId] = useState(locationUseCaseId)
  const isOverviewShown = locationUseCaseId === OVERVIEW_ID
  const [isCreatePoolModalShown, showCreatePoolModal, hideCreatePoolModal] = useModal()

  // On first run get the a usecase from email or download use case pools.
  const hasPools = !!pools.length
  const hasSelectedUseCase = !!selectedUseCase
  useEffect((): void => {
    if (!isFirstRun) {
      return
    }
    setIsFirstRun(false)
    const {email, ticketId, userId} = parseQueryString(search.slice(1))
    if (!hasSelectedUseCase && (email || userId || ticketId)) {
      dispatch(createUseCase({email, ticketId, userId})).
        then((selectedUseCase: bayes.bob.UseCase|void): void => {
          if (selectedUseCase) {
            selectUseCase(selectedUseCase)
          }
        })
      return
    }
    if (!hasPools) {
      dispatch(getEvalUseCasePools()).then((pools: void|readonly bayes.bob.UseCasePool[]): void => {
        if (pools) {
          setPools(pools)
        }
      })
    }
  }, [dispatch, hasPools, hasSelectedUseCase, isFirstRun, search, selectedUseCase])

  // Select the first pool when they are loaded.
  const hasPoolName = !!poolName
  useEffect((): void => {
    if (pools && !hasPoolName) {
      setPoolName(pools.length ? pools[0].name : undefined)
    }
  }, [pools, hasPoolName])

  // Get usecases for the selected pool.
  useEffect((): void => {
    if (!poolName) {
      return
    }
    setUseCases([])
    selectUseCase(undefined)
    dispatch(getEvalUseCases(poolName)).
      then((useCases: readonly bayes.bob.UseCase[]|void): void => {
        if (useCases) {
          setUseCases(useCases)
        } else {
          setPoolName(undefined)
        }
      })
  }, [dispatch, poolName])

  useEffect((): void => {
    if (isOverviewShown || selectedUseCase || !useCases) {
      return
    }
    const initialUseCase = initialUseCaseId && useCases.find(
      ({useCaseId}: bayes.bob.UseCase): boolean => useCaseId === initialUseCaseId)
    selectUseCase(initialUseCase || useCases.length && useCases[0] || undefined)
  }, [initialUseCaseId, isOverviewShown, selectedUseCase, useCases])

  useEffect((): void => {
    const {userData = emptyUser} = selectedUseCase || {}
    dispatch({type: 'SELECT_USER', user: userData})
  }, [dispatch, selectedUseCase])

  const urlFromState = ((): string|null => {
    const {email, poolName: poolNameFromUrl, ticketId, userId} = parse(search)
    const selectedUseCaseId = selectedUseCase ? selectedUseCase.useCaseId :
      (locationUseCaseId === OVERVIEW_ID) ? OVERVIEW_ID : ''
    if (email || ticketId || userId ||
      poolName === poolNameFromUrl && selectedUseCaseId === locationUseCaseId) {
      return null
    }
    const searchString = poolName ? `?poolName=${encodeURIComponent(poolName)}` : ''
    return `${Routes.EVAL_PAGE}/${selectedUseCaseId}${searchString}`
  })()

  const selectNextUseCase = useCallback((): void => {
    let nextUseCase: bayes.bob.UseCase|undefined = undefined;
    (useCases || []).forEach((useCase: bayes.bob.UseCase): void => {
      const indexInPool = useCase.indexInPool || 0
      if (indexInPool <= (selectedUseCase && selectedUseCase.indexInPool || 0)) {
        return
      }
      if (!nextUseCase || indexInPool < (nextUseCase && nextUseCase.indexInPool || 0)) {
        nextUseCase = useCase
      }
    })
    selectUseCase(nextUseCase)
  }, [selectedUseCase, useCases])

  const savedEvalRef = useRef<CancelablePromise<{}>|undefined>()
  // Cancel the aftermath of saving the eval on unmount.
  useEffect((): (() => void) => (): void => savedEvalRef.current?.cancel(), [])
  // Cancel the aftermath of saving the eval if a new use case is selected.
  useEffect((): void => savedEvalRef.current?.cancel(), [selectedUseCase])

  const handleSaveEval = useCallback(
    (useCase: bayes.bob.UseCase, evaluation: bayes.bob.UseCaseEvaluation): Promise<void> => {
      const {useCaseId = undefined, evaluation: selectedEval = undefined} = useCase || {}
      if (!useCaseId) {
        return Promise.resolve()
      }
      return new Promise((resolve: () => void): void => {
        // Let the pool know if the use case got evaluated for the first time.
        if (!selectedEval) {
          setPools(pools => pools.map((pool): bayes.bob.UseCasePool => {
            if (pool.name === poolName) {
              return {
                ...pool,
                evaluatedUseCaseCount: (pool.evaluatedUseCaseCount || 0) + 1,
              }
            }
            return pool
          }))
        }
        setUseCases((useCases) => useCases.map((useCase): bayes.bob.UseCase => {
          if (useCase.useCaseId === useCaseId) {
            return {
              ...useCase,
              evaluation,
            }
          }
          return useCase
        }))
        const saveEval = makeCancelable(fetchGoogleIdToken().
          then((googleIdToken): Promise<{}> => fetch(`/api/eval/use-case/${useCaseId}`, {
            body: JSON.stringify(evaluation),
            headers: {
              'Authorization': 'Bearer ' + googleIdToken,
              'Content-Type': 'application/json',
            },
            method: 'post',
          })))
        saveEval.promise.then(selectNextUseCase).then(resolve)
        savedEvalRef.current?.cancel()
        savedEvalRef.current = saveEval
      })
    }, [fetchGoogleIdToken, poolName, selectNextUseCase])

  const handleUseCaseChange = useCallback((selectedUseCaseId: string): void => {
    if (selectedUseCaseId !== OVERVIEW_ID) {
      selectUseCase(useCases.find(({useCaseId}): boolean => useCaseId === selectedUseCaseId))
      return
    }
    selectUseCase(undefined)
    const searchString = poolName ? `?poolName=${encodeURIComponent(poolName)}` : ''
    history.push(`${Routes.EVAL_PAGE}/${OVERVIEW_ID}${searchString}`)
  }, [history, poolName, useCases])

  const handleNewUseCase = useCallback((selectedUseCase: bayes.bob.UseCase): void => {
    hideCreatePoolModal()
    selectUseCase(selectedUseCase)
  }, [hideCreatePoolModal])

  const {t} = useTranslation()
  const poolOptions = pools.
    map(({evaluatedUseCaseCount, name = '', useCaseCount}): SelectOption => {
      const isPoolEvaluated = evaluatedUseCaseCount === useCaseCount
      return {
        name: (isPoolEvaluated ? '✅ ' :
          evaluatedUseCaseCount && evaluatedUseCaseCount >= 10 ? '✓ ' : '🎯 ') + name,
        value: name,
      }
    })
  const overviewOption: SelectOption = {
    name: 'Sommaire',
    value: OVERVIEW_ID,
  } as const
  const useCasesOptions = [overviewOption].concat([...useCases].
    sort((a: bayes.bob.UseCase, b: bayes.bob.UseCase): number =>
      (a.indexInPool || 0) - (b.indexInPool || 0)).
    map(({indexInPool, title, useCaseId, userData, evaluation}): SelectOption => {
      return {
        name: (evaluation ? '✅ ' : '🎯 ') +
          (indexInPool || 0).toString() + ' - ' + getUseCaseTitle(t, title, userData),
        value: useCaseId || '',
      }
    }))
  const {useCaseId = undefined} = selectedUseCase || {}
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
  if (urlFromState) {
    return <Redirect to={urlFromState} push={true} />
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
        onChange={handleUseCaseChange} style={{backgroundColor: '#fff'}} />
      <div style={{margin: '5px 0 10px', textAlign: 'center'}}>
        <Button onClick={showCreatePoolModal}>
          Créer un cas d'utilisation
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
UseCaseEvalPageBase.propTypes = {
  fetchGoogleIdToken: PropTypes.func.isRequired,
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
    'fontSize': 13,
    'fontWeight': 500,
    'opacity': isSelected ? 1 : .5,
    'padding': '25px 10px',
    'textAlign': 'center',
  }), [isSelected])
  return <RadiumDiv style={containerStyle} onClick={handleClick}>
    <img src={image} alt="" style={{paddingBottom: 10}} /><br />
    {children}
  </RadiumDiv>
}
ScoreButtonBase.propTypes = {
  children: PropTypes.node.isRequired,
  image: PropTypes.string.isRequired,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  score: PropTypes.string.isRequired,
}
const ScoreButton = React.memo(ScoreButtonBase)


const conceptEvalPageStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
}


const ConceptEvalPageBase = (): React.ReactElement => {
  const {t} = useTranslation()
  return <div style={conceptEvalPageStyle}>
    <UseCaseSelector t={t} />
    <CategoriesDistribution style={{maxWidth: 1000}} />
  </div>
}
const ConceptEvalPage = React.memo(ConceptEvalPageBase)


interface AuthEvalPageConnectedProps {
  fetchGoogleIdToken?: () => Promise<string>
}
interface AuthEvalPageProps
  extends RouteComponentProps<{useCaseId: string}>, AuthEvalPageConnectedProps {
  dispatch: DispatchAllEvalActions
}


const AuthenticateEvalPageBase = (props: AuthEvalPageProps): React.ReactElement => {
  const [hasAuthenticationFailed, setHasAuthenticationFailed] = useState(false)
  const {dispatch, fetchGoogleIdToken} = props

  const handleGoogleFailure = useCallback((): void => setHasAuthenticationFailed(true), [])

  const handleGoogleLogin = useCallback(
    (googleResponse: GoogleLoginResponse|GoogleLoginResponseOffline): void => {
      const googleUser = googleResponse as GoogleLoginResponse
      if (!googleUser.getId) {
        throw new Error('Google Login offline response, this should never happen')
      }
      const googleIdToken = googleUser.getAuthResponse().id_token
      fetch('/api/eval/authorized', {
        headers: {Authorization: 'Bearer ' + googleIdToken},
      }).then((response): void => {
        if (response.status >= 400 || response.status < 200) {
          handleGoogleFailure()
          return
        }
        dispatch({googleUser, type: 'AUTH'})
      })
    },
    [dispatch, handleGoogleFailure],
  )

  if (fetchGoogleIdToken) {
    return <Switch>
      <Route path={Routes.CONCEPT_EVAL_PAGE}>
        <ConceptEvalPage />
      </Route>
      <Route path={Routes.EVAL_PATH}>
        <UseCaseEvalPage fetchGoogleIdToken={fetchGoogleIdToken} />
      </Route>
    </Switch>
  }

  return <div style={{padding: 20, textAlign: 'center'}}>
    <GoogleLogin
      clientId={config.googleSSOClientId}
      isSignedIn={true}
      // TODO(cyrille): Drop once https://github.com/anthonyjgrove/react-google-login/issues/333
      // is resolved.
      onAutoLoadFinished={noOp}
      onSuccess={handleGoogleLogin}
      onFailure={handleGoogleFailure} />
    {hasAuthenticationFailed ? <div style={{margin: 20}}>
      L'authentification a échoué. L'accès à cet outil est restreint.<br />
      Contactez nous : contact@bob-emploi.fr
    </div> : null}
  </div>
}
AuthenticateEvalPageBase.propTypes = {
  dispatch: PropTypes.func.isRequired,
  fetchGoogleIdToken: PropTypes.func,
}
const AuthenticateEvalPage = connect(({auth}: EvalRootState): AuthEvalPageConnectedProps => ({
  fetchGoogleIdToken: auth.fetchGoogleIdToken,
}))(React.memo(AuthenticateEvalPageBase))



function fetchGoogleIdToken(googleUser: GoogleLoginResponse): Promise<string> {
  const {'expires_at': expiresAt, 'id_token': idToken} = googleUser.getAuthResponse()
  if (expiresAt > new Date().getTime()) {
    return Promise.resolve(idToken)
  }
  return googleUser.reloadAuthResponse().then(({id_token: googleIdToken}): string => googleIdToken)
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
  // sentryMiddleware needs to be first to correctly catch exception down the line.
  applyMiddleware(createSentryMiddleware(), thunk, routerMiddleware(history)),
)(createStore)

// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(
  combineReducers({
    app,
    asyncState,
    auth: evalAuthReducer,
    router: connectRouter(history),
    user: evalUserReducer,
  }),
)
if (module.hot) {
  module.hot.accept(['store/app_reducer'], (): void => {
    const {app: newApp, asyncState: newAsyncState} = require('store/app_reducer')
    store.replaceReducer(combineReducers({
      app: newApp as typeof app,
      asyncState: newAsyncState as typeof asyncState,
      auth: evalAuthReducer,
      router: connectRouter(history),
      user: evalUserReducer,
    }))
  })
}


interface HeaderLinkProps extends React.HTMLProps<HTMLSpanElement> {
  isSelected?: boolean
}


const HeaderLinkBase = (props: HeaderLinkProps): React.ReactElement => {
  const {children, isSelected, style, ...extraProps} = props
  const containerStyle = useMemo((): React.CSSProperties => ({
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: isSelected ? 'bold' : 'initial',
    marginRight: 30,
    textAlign: 'center',
    width: 80,
    ...style,
  }), [isSelected, style])
  return <span style={containerStyle} {...extraProps}>
    {children}
  </span>
}
HeaderLinkBase.propTypes = {
  children: PropTypes.node,
  isSelected: PropTypes.bool,
  style: PropTypes.object,
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
    <strong style={{alignSelf: 'flex-start', paddingBottom: 25}}>Évaluation</strong>
    <Textarea
      style={{minHeight: 100, width: '100%'}} value={comments || ''}
      placeholder="Commentaires"
      onChange={handleCommentChange} />
    <div style={scorePanelButtonsContainerStyle}>
      <div style={{display: 'flex'}}>
        {EVAL_SCORES.map((level): React.ReactNode => <ScoreButton
          key={`${level.score}-button`}
          onClick={updateScore}
          isSelected={score === level.score} image={level.image}
          score={level.score}>
          {level.title}
        </ScoreButton>)}
      </div>
      <div style={{margin: '10px 0', paddingRight: 10}}>
        {isModified ?
          <Button type="validation" onClick={onSave}>Enregister</Button>
          :
          <Button type="navigation" onClick={selectNextUseCase}>Suivant</Button>
        }
      </div>
    </div>
    <div style={savedMessageStyle}>
      Évaluation sauvegardée
    </div>
  </div>
}
ScorePanelBase.propTypes = {
  evaluation: PropTypes.shape({
    comments: PropTypes.string,
    score: PropTypes.string,
  }).isRequired,
  isModified: PropTypes.bool,
  isSaved: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  selectNextUseCase: PropTypes.func.isRequired,
  style: PropTypes.object,
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
    <div style={{backgroundColor: colors.BACKGROUND_GREY, color: colors.DARK_TWO}}>
      <ConnectedRouter history={history}>
        <Route path={Routes.EVAL_PAGE} component={AuthenticateEvalPage} />
      </ConnectedRouter>
      <EvalSnackbar timeoutMillisecs={4000} />
    </div>
  </Suspense>
</Provider>


export {App}

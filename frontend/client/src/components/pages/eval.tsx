import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {createBrowserHistory} from 'history'
import {TFunction} from 'i18next'
import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React, {Suspense, useCallback, useMemo, useState} from 'react'
import GoogleLogin, {GoogleLoginResponse, GoogleLoginResponseOffline} from 'react-google-login'
import {useTranslation} from 'react-i18next'
import {connect, Provider} from 'react-redux'
import {Redirect, Route, RouteComponentProps, Switch} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'

import {AllEvalActions, AuthEvalState, DispatchAllEvalActions, EvalRootState,
  computeAdvicesForProject, diagnoseProject, getEvalUseCasePools, strategizeProject,
  getEvalUseCases, getLaborStats, getAllCategories, createUseCase, simulateFocusEmails,
  hideToasterMessageAction} from 'store/actions'

import {app, asyncState} from 'store/app_reducer'
import {getUseCaseTitle} from 'store/eval'
import {init as i18nInit} from 'store/i18n'
import {parseQueryString, parsedValueFlattener} from 'store/parse'
import {createSentryMiddleware} from 'store/sentry'

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


interface EvalPanelConfig {
  name: string
  panelId: EvalPanel
  predicate: (state: UseCaseEvalPageState) => boolean
}


const panels: readonly EvalPanelConfig[] = [
  {
    name: 'Diagnostic',
    panelId: DIAGNOSTIC_PANEL,
    predicate: ({diagnostic}: UseCaseEvalPageState): boolean => !!diagnostic,
  },
  {
    name: 'Conseils',
    panelId: ADVICE_PANEL,
    predicate: ({advices}: UseCaseEvalPageState): boolean => !!(advices && advices.length),
  },
  {
    name: 'Stratégies',
    panelId: STRATEGIES_PANEL,
    predicate: ({strategies}: UseCaseEvalPageState): boolean => !!(strategies && strategies.length),
  },
  {
    name: 'Statistiques',
    panelId: STATS_PANEL,
    predicate: (): boolean => true,
  },
  {
    name: 'Coaching',
    panelId: COACHING_PANEL,
    predicate: ({emailsSent}: UseCaseEvalPageState): boolean => !!(emailsSent && emailsSent.length),
  },
]


const emptyUser = {} as const


interface UseCaseEvalPageProps extends RouteComponentProps<{useCaseId: string}> {
  dispatch: DispatchAllEvalActions
  fetchGoogleIdToken: () => Promise<string>
  t: TFunction
}


interface UseCaseEvalPageState {
  advices?: readonly bayes.bob.Advice[]
  diagnostic?: bayes.bob.Diagnostic
  categories?: readonly bayes.bob.DiagnosticCategory[]
  coachingEmailFrequency: bayes.bob.EmailFrequency
  emailsSent?: readonly bayes.bob.EmailSent[]
  evaluation?: bayes.bob.UseCaseEvaluation
  initialUseCaseId?: string
  isCreatePoolModalShown?: boolean
  isModified?: boolean
  isOverviewShown?: boolean
  isSaved?: boolean
  jobGroupInfo?: bayes.bob.JobGroup
  localStats?: bayes.bob.LocalJobStats
  pools: readonly bayes.bob.UseCasePool[]
  selectedPoolName?: string
  selectedUseCase?: bayes.bob.UseCase
  shownPanel?: EvalPanel
  strategies?: readonly bayes.bob.Strategy[]
  useCases: readonly bayes.bob.UseCase[]
  userCounts?: bayes.bob.UsersCount
}


interface SelectOption {
  name: string
  value: string
}


class UseCaseEvalPage extends React.Component<UseCaseEvalPageProps, UseCaseEvalPageState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    fetchGoogleIdToken: PropTypes.func.isRequired,
    location: ReactRouterPropTypes.location.isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        useCaseId: PropTypes.string,
      }).isRequired,
    }).isRequired,
    t: PropTypes.func.isRequired,
  }

  public state: UseCaseEvalPageState = {
    advices: [],
    categories: [],
    coachingEmailFrequency: 'EMAIL_MAXIMUM',
    diagnostic: undefined,
    evaluation: {},
    initialUseCaseId: undefined,
    isCreatePoolModalShown: false,
    isModified: false,
    isOverviewShown: false,
    isSaved: false,
    jobGroupInfo: undefined,
    localStats: undefined,
    pools: emptyArray,
    selectedPoolName: undefined,
    selectedUseCase: undefined,
    shownPanel: DIAGNOSTIC_PANEL,
    strategies: undefined,
    useCases: emptyArray,
  }

  public static getDerivedStateFromProps(
    {location: {search}, match: {params: {useCaseId}}}: UseCaseEvalPageProps,
    {selectedPoolName}: UseCaseEvalPageState):
    Pick<UseCaseEvalPageState, 'initialUseCaseId'|'isOverviewShown'|'selectedPoolName'>|null {
    if (selectedPoolName) {
      return null
    }
    const {poolName} = parse(search)
    if (!poolName) {
      return null
    }
    return {
      initialUseCaseId: useCaseId,
      isOverviewShown: useCaseId === OVERVIEW_ID,
      selectedPoolName: parsedValueFlattener.last(poolName),
    }
  }

  public componentDidMount(): void {
    const {dispatch} = this.props
    if (this.getUseCaseFromEmail()) {
      return
    }
    dispatch(getEvalUseCasePools()).then((pools: void|readonly bayes.bob.UseCasePool[]): void => {
      this.setState({
        pools: pools || [],
        selectedPoolName: this.state.selectedPoolName ||
          (pools && pools.length ? pools[0].name : undefined),
      }, this.fetchPoolUseCases)
    })
  }

  public componentWillUnmount(): void {
    this.isUnmounting = true
  }

  private isUnmounting = false

  private getUseCaseFromEmail(): boolean {
    const {dispatch, location: {search}} = this.props
    const {email, ticketId, userId} = parseQueryString(search.slice(1))
    if (!email && !userId && !ticketId) {
      return false
    }
    dispatch(createUseCase({email, ticketId, userId})).
      then((selectedUseCase: bayes.bob.UseCase|void): void => {
        if (!selectedUseCase || this.isUnmounting) {
          return
        }
        this.setState({selectedUseCase}, this.advise)
      })
    return true
  }

  private fetchPoolUseCases(): void {
    const {dispatch} = this.props
    const {isOverviewShown, initialUseCaseId, selectedPoolName} = this.state
    if (!selectedPoolName) {
      return
    }
    dispatch(getEvalUseCases(selectedPoolName)).
      then((useCases: readonly bayes.bob.UseCase[]|void): void => {
        if (!useCases) {
          return
        }
        const initialUseCase = initialUseCaseId && useCases.find(
          ({useCaseId}: bayes.bob.UseCase): boolean => useCaseId === initialUseCaseId)
        this.setState({useCases})
        if (!isOverviewShown) {
          this.selectUseCase(initialUseCase || useCases.length && useCases[0] || null)
        }
      })
  }

  private handleChoosePanel = _memoize((wantedPanel?: string): (() => void) => (): void => {
    const availablePanels = panels.filter(({predicate}): boolean => predicate(this.state))
    const {panelId: nextPanel} =
      availablePanels.find(({panelId}): boolean => panelId === wantedPanel) ||
      availablePanels[0]
    this.setState(({shownPanel}): Pick<UseCaseEvalPageState, 'shownPanel'> =>
      nextPanel === shownPanel ? {} : {shownPanel: nextPanel})
  })

  private advise = (): void => {
    const {dispatch} = this.props
    const {selectedUseCase} = this.state
    if (!selectedUseCase || !selectedUseCase.userData) {
      return
    }
    const {userData} = selectedUseCase
    dispatch(getLaborStats(userData)).then((laborStats): void => {
      if (!laborStats || this.isUnmounting || this.state.selectedUseCase !== selectedUseCase) {
        return
      }
      const {jobGroupInfo, localStats, userCounts} = laborStats
      this.setState({jobGroupInfo, localStats, userCounts})
    })
    dispatch(getAllCategories(selectedUseCase)).
      then((response: bayes.bob.DiagnosticCategories | void): void => {
        if (!response || this.isUnmounting || this.state.selectedUseCase !== selectedUseCase) {
          return
        }
        this.setState({categories: response.categories})
      })
    // Compute the diagnostic.
    dispatch(diagnoseProject(userData)).
      // Set diagnostic on state and compute the advice modules.
      then((diagnostic: bayes.bob.Diagnostic|void): void => {
        if (!diagnostic || this.isUnmounting || this.state.selectedUseCase !== selectedUseCase) {
          return
        }
        this.setState({diagnostic})
        const userWithDiagnostic = {
          ...userData,
          projects: [{
            ...userData.projects?.[0],
            diagnostic,
          }],
        }
        dispatch(computeAdvicesForProject(userWithDiagnostic)).
          then((response: bayes.bob.Advices|void): void => {
            if (this.isUnmounting || !response || !response.advices ||
              this.state.selectedUseCase !== selectedUseCase) {
              return
            }
            this.setState({advices: response.advices})
            const userWithAdviceAndDiagnostic = {
              ...userData,
              projects: [{
                ...userData.projects?.[0],
                advices: response.advices,
                diagnostic,
              }],
            }
            dispatch(strategizeProject(userWithAdviceAndDiagnostic)).
              then((response: bayes.bob.Strategies|void): void => {
                if (!response || this.isUnmounting ||
                  this.state.selectedUseCase !== selectedUseCase) {
                  return
                }
                this.setState({strategies: response.strategies})
                this.updateCoachingEmails()
              })
          })
      })
  }

  private updateCoachingEmails = (): void => {
    const {dispatch} = this.props
    const {advices, coachingEmailFrequency, diagnostic, selectedUseCase, strategies} = this.state
    if (!selectedUseCase) {
      return
    }
    const {userData} = selectedUseCase
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
    dispatch(simulateFocusEmails(userWithAdviceDiagnosticAndStrategies)).
      then((response: bayes.bob.User|void): void => {
        if (!response || this.isUnmounting || !response.emailsSent ||
          this.state.selectedUseCase !== selectedUseCase) {
          return
        }
        this.setState({emailsSent: response.emailsSent})
      })
  }

  private getUrlFromState(): string|null {
    const {selectedPoolName, selectedUseCase} = this.state
    const {match: {params: {useCaseId}}, location: {search}} = this.props
    const {email, poolName, ticketId, userId} = parse(search)
    const selectedUseCaseId = selectedUseCase ? selectedUseCase.useCaseId : OVERVIEW_ID
    if (email || ticketId || userId ||
      poolName === selectedPoolName && selectedUseCaseId === useCaseId) {
      return null
    }
    const searchString = selectedPoolName ? `?poolName=${encodeURIComponent(selectedPoolName)}` : ''
    return `${Routes.EVAL_PAGE}/${selectedUseCaseId}${searchString}`
  }

  private selectUseCase = (selectedUseCase?: bayes.bob.UseCase|null): void => {
    const {evaluation = {}, userData = emptyUser} = selectedUseCase || {}
    this.setState({
      advices: [],
      categories: [],
      diagnostic: undefined,
      emailsSent: [],
      evaluation,
      isModified: false,
      isOverviewShown: false,
      isSaved: false,
      jobGroupInfo: undefined,
      localStats: undefined,
      selectedUseCase: selectedUseCase || undefined,
      strategies: [],
      userCounts: undefined,
    }, this.advise)
    this.props.dispatch({type: 'SELECT_USER', user: userData})
  }

  private handlePoolChange = (selectedPoolName: string): void => {
    this.setState({selectedPoolName}, this.fetchPoolUseCases)
  }

  private handleCoachingEmailFrequency =
  (coachingEmailFrequency: bayes.bob.EmailFrequency): void => {
    this.setState({coachingEmailFrequency}, this.updateCoachingEmails)
  }

  private selectNextUseCase = (): void => {
    const {selectedUseCase, useCases} = this.state
    let nextUseCase: bayes.bob.UseCase|null = null;
    (useCases || []).forEach((useCase: bayes.bob.UseCase): void => {
      const indexInPool = useCase.indexInPool || 0
      if (indexInPool <= (selectedUseCase && selectedUseCase.indexInPool || 0)) {
        return
      }
      if (!nextUseCase || indexInPool < (nextUseCase && nextUseCase.indexInPool || 0)) {
        nextUseCase = useCase
      }
    })
    if (nextUseCase) {
      this.selectUseCase(nextUseCase)
    } else {
      this.handleUseCaseChange(OVERVIEW_ID)
    }
  }

  private handleSaveEval = (): void => {
    const {evaluation, pools, selectedPoolName, selectedUseCase, useCases} = this.state
    const {useCaseId = undefined, evaluation: selectedEval = undefined} = selectedUseCase || {}
    if (!useCaseId) {
      return
    }
    this.setState({
      // Let the pool know if the use case got evaluated for the first time.
      pools: selectedEval ? pools : pools.map((pool): bayes.bob.UseCasePool => {
        if (pool.name === selectedPoolName) {
          return {
            ...pool,
            evaluatedUseCaseCount: (pool.evaluatedUseCaseCount || 0) + 1,
          }
        }
        return pool
      }),
      useCases: useCases.map((useCase): bayes.bob.UseCase => {
        if (useCase.useCaseId === useCaseId) {
          return {
            ...useCase,
            evaluation,
          }
        }
        return useCase
      }),
    })
    this.props.fetchGoogleIdToken().
      then((googleIdToken): Promise<{}> => fetch(`/api/eval/use-case/${useCaseId}`, {
        body: JSON.stringify(evaluation),
        headers: {
          'Authorization': 'Bearer ' + googleIdToken,
          'Content-Type': 'application/json',
        },
        method: 'post',
      })).
      then((): void => {
        if (selectedUseCase !== this.state.selectedUseCase) {
          return
        }
        this.setState({
          isModified: false,
          isSaved: true,
        })
        this.selectNextUseCase()
      })
  }

  private handleUseCaseChange = (selectedUseCaseId: string): void => {
    if (selectedUseCaseId !== OVERVIEW_ID) {
      this.selectUseCase(
        this.state.useCases.find(({useCaseId}): boolean => useCaseId === selectedUseCaseId))
      return
    }
    this.setState({
      isOverviewShown: true,
      selectedUseCase: undefined,
    })
    this.props.dispatch({type: 'SELECT_USER', user: emptyUser})
  }

  private handleRescoreAdvice = (adviceId: string, newScore: string): void => {
    const {evaluation} = this.state
    if (!newScore) {
      const modules: {[key: string]: number} = {...evaluation && evaluation.modules}
      delete modules[adviceId]
      this.setState({
        evaluation: {
          ...evaluation,
          modules,
        },
      })
      return
    }
    this.setState({
      evaluation: {
        ...evaluation,
        modules: {
          ...(evaluation && evaluation.modules),
          [adviceId]: parseInt(newScore, 10),
        },
      },
      isModified: true,
    })
  }

  private handleEvaluateAdvice =
  (adviceId: string, adviceEvaluation: bayes.bob.AdviceEvaluation): void => {
    const {evaluation} = this.state
    const advices = evaluation && evaluation.advices
    this.setState({
      evaluation: {
        ...evaluation,
        advices: {
          ...advices,
          [adviceId]: {
            ...(advices && advices[adviceId]),
            ...adviceEvaluation,
          },
        },
      },
      isModified: true,
    })
  }

  private handleEvaluateDiagnosticSection =
  (sectionId: string, sectionEvaluation: bayes.bob.GenericEvaluation): void => {
    const {evaluation} = this.state
    const diagnostic = evaluation && evaluation.diagnostic
    this.setState({
      evaluation: {
        ...evaluation,
        diagnostic: {
          ...diagnostic,
          [sectionId]: {
            ...(diagnostic && diagnostic[sectionId]),
            ...sectionEvaluation,
          },
        },
      },
      isModified: true,
    })
  }

  private handleShowCreatePoolModal = _memoize((isCreatePoolModalShown): (() => void) =>
    (): void => this.setState({isCreatePoolModalShown}))

  private handleNewUseCase = (selectedUseCase: bayes.bob.UseCase): void => {
    this.handleShowCreatePoolModal(false)()
    this.setState({selectedUseCase}, this.advise)
  }

  private renderCreatePoolModal(): React.ReactNode {
    return <CreatePoolModal
      dispatch={this.props.dispatch}
      isShown={this.state.isCreatePoolModalShown}
      onTransientCreated={this.handleNewUseCase}
      onClose={this.handleShowCreatePoolModal(false)} />
  }

  private renderHeaderLink = ({name, panelId, predicate}: EvalPanelConfig): React.ReactNode => {
    const isAvailable = predicate(this.state)
    const {shownPanel} = this.state
    const toggleTitleStyle = {
      ':hover': {
        borderBottom: `2px solid ${colors.BOB_BLUE_HOVER}`,
      },
      'borderBottom': shownPanel === panelId ? `2px solid ${colors.BOB_BLUE}` : 'initial',
      'opacity': isAvailable ? 1 : .5,
      'paddingBottom': 5,
    }
    return <HeaderLink
      onClick={this.handleChoosePanel(panelId)} isSelected={shownPanel === panelId} key={panelId}>
      <RadiumSpan style={toggleTitleStyle}>{name}</RadiumSpan>
    </HeaderLink>
  }

  private updateEvaluation = (changes: bayes.bob.UseCaseEvaluation): void => {
    const {evaluation} = this.state
    this.setState({
      evaluation: {
        ...evaluation,
        ...changes,
      },
      isModified: true,
    })
  }

  private renderPanelContent(
    profile: bayes.bob.UserProfile, project: bayes.bob.Project): React.ReactNode {
    const {advices, categories, coachingEmailFrequency, diagnostic, emailsSent, evaluation,
      jobGroupInfo, localStats, shownPanel, strategies, userCounts} = this.state
    const fullProject = {
      ...project,
      advices,
      diagnostic,
      localStats,
      strategies,
    }
    const isPanelAvailable = !!panels.some(({panelId, predicate}): boolean =>
      panelId === shownPanel && predicate(this.state))
    if (!isPanelAvailable) {
      return null
    }
    switch (shownPanel) {
      case DIAGNOSTIC_PANEL:
        return <Assessment
          diagnostic={diagnostic || emptyObject}
          diagnosticEvaluations={evaluation && evaluation.diagnostic || emptyObject}
          onEvaluateSection={this.handleEvaluateDiagnosticSection}
        />
      case ADVICE_PANEL:
        return <AdvicesRecap
          profile={profile} project={fullProject} advices={advices || emptyArray}
          adviceEvaluations={evaluation && evaluation.advices || emptyObject}
          onEvaluateAdvice={this.handleEvaluateAdvice}
          onRescoreAdvice={this.handleRescoreAdvice}
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
          onChangeFrequency={this.handleCoachingEmailFrequency} />
    }
  }

  // TODO(cyrille): Move to its own component.
  private renderBobMindPanel(
    profile: bayes.bob.UserProfile, project: bayes.bob.Project): React.ReactNode {
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
    return <div style={style}>
      <div style={toggleStyle}>
        {panels.map(this.renderHeaderLink)}
      </div>
      {this.renderPanelContent(profile, project)}
    </div>
  }

  public render(): React.ReactNode {
    const {t} = this.props
    const {evaluation, isOverviewShown, isModified, isSaved, pools, selectedPoolName,
      selectedUseCase, useCases} = this.state
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
            (indexInPool || 0).toString() + ' - ' + getUseCaseTitle(this.props.t, title, userData),
          value: useCaseId || '',
        }
      }))
    const {useCaseId = undefined, userData = undefined} = selectedUseCase || {}
    const {profile = null, projects = []} = userData || {}
    const project = projects && projects.length && projects[0] || {}
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
    const redirectUrl = this.getUrlFromState()
    if (redirectUrl) {
      return <Redirect to={redirectUrl} push={true} />
    }
    return <div style={style}>
      {this.renderCreatePoolModal()}
      <div style={letfBarStyle}>
        <Select
          options={poolOptions} value={selectedPoolName}
          onChange={this.handlePoolChange} style={{backgroundColor: '#fff', marginBottom: 5}} />
        <Select
          options={useCasesOptions} value={useCaseId || undefined}
          onChange={this.handleUseCaseChange} style={{backgroundColor: '#fff'}} />
        <div style={{margin: '5px 0 10px', textAlign: 'center'}}>
          <Button onClick={this.handleShowCreatePoolModal(true)}>
            Créer un cas d'utilisation
          </Button>
        </div>
        {selectedUseCase ? <UseCase useCase={selectedUseCase} t={t} /> : null}
        {isOverviewShown ? <PoolOverview
          useCases={useCases} onSelectUseCase={this.selectUseCase} /> : null}
      </div>
      <div style={centralPanelstyle}>
        {selectedUseCase ? this.renderBobMindPanel(profile || emptyObject, project) : null}
        {(isOverviewShown || !evaluation) ? null :
          <ScorePanel
            evaluation={evaluation}
            isModified={!!isModified}
            isSaved={!!isSaved}
            onSave={this.handleSaveEval}
            onUpdate={this.updateEvaluation}
            selectNextUseCase={this.selectNextUseCase}
            style={{marginTop: 20}} />}
      </div>
    </div>
  }
}


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
    <CategoriesDistribution style={{maxWidth: 1000}} t={t} />
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
  const {dispatch, fetchGoogleIdToken, ...otherProps} = props

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

  const {t} = useTranslation()

  if (fetchGoogleIdToken) {
    return <Switch>
      <Route path={Routes.CONCEPT_EVAL_PAGE}>
        <ConceptEvalPage />
      </Route>
      <Route path="*">
        <UseCaseEvalPage
          dispatch={dispatch} t={t} fetchGoogleIdToken={fetchGoogleIdToken} {...otherProps} />
      </Route>
    </Switch>
  }

  return <div style={{padding: 20, textAlign: 'center'}}>
    <GoogleLogin
      clientId={config.googleSSOClientId}
      isSignedIn={true}
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
        <Route path={Routes.EVAL_PATH} component={AuthenticateEvalPage} />
      </ConnectedRouter>
      <EvalSnackbar timeoutMillisecs={4000} />
    </div>
  </Suspense>
</Provider>


export {App}

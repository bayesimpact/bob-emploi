import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {createBrowserHistory} from 'history'
import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import Radium from 'radium'
import React from 'react'
import GoogleLogin from 'react-google-login'
import {connect, Provider} from 'react-redux'
import {Redirect, Route, RouteComponentProps, Switch} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'

import {AllEvalActions, AuthEvalState, DispatchAllEvalActions, EvalRootState,
  computeAdvicesForProject, diagnoseProject, getEvalUseCasePools, strategizeProject,
  getEvalUseCases, getLaborStats, getAllCategories, createUseCase} from 'store/actions'

import {app, asyncState} from 'store/app_reducer'
import {getUseCaseTitle} from 'store/eval'

import {Snackbar} from 'components/snackbar'
import {Button, SmoothTransitions, Textarea} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'
import {Routes} from 'components/url'

import {Strategies} from './connected/project/strategy'
import {AdvicesRecap} from './eval/advices_recap'
import {Assessment} from './eval/assessment'
import {CategoriesDistribution, UseCaseSelector} from './eval/categories'
import {CreatePoolModal} from './eval/create_pool_modal'
import {PoolOverview} from './eval/overview'
import {EVAL_SCORES} from './eval/score_levels'
import {Stats} from './eval/statistics'
import {UseCase} from './eval/use_case'

require('normalize.css')
require('styles/App.css')

const OVERVIEW_ID = 'sommaire'
const DIAGNOSTIC_PANEL = 'diagnostic'
const ADVICE_PANEL = 'advice'
const STRATEGIES_PANEL = 'strategies'
const STATS_PANEL = 'statistics'

type EvalPanel =
  | typeof DIAGNOSTIC_PANEL
  | typeof ADVICE_PANEL
  | typeof STRATEGIES_PANEL
  | typeof STATS_PANEL


const getEmptyString = (): string => ''


interface EvalPanelConfig {
  name: string
  panelId: EvalPanel
  predicate: (state: UseCaseEvalPageState) => boolean
}


const panels: EvalPanelConfig[] = [
  {
    name: 'Diagnostic',
    panelId: DIAGNOSTIC_PANEL,
    predicate: ({diagnostic}: UseCaseEvalPageState): boolean => !!diagnostic,
  },
  {
    name: 'Conseils',
    panelId: ADVICE_PANEL,
    predicate: ({advices}: UseCaseEvalPageState): boolean => advices && !!advices.length,
  },
  {
    name: 'Stratégies',
    panelId: STRATEGIES_PANEL,
    predicate: ({strategies}: UseCaseEvalPageState): boolean => strategies && !!strategies.length,
  },
  {
    name: 'Statistiques',
    panelId: STATS_PANEL,
    predicate: (): boolean => true,
  },
]

interface UseCaseEvalPageProps extends RouteComponentProps<{useCaseId: string}> {
  dispatch: DispatchAllEvalActions
  fetchGoogleIdToken: () => Promise<string>
}


interface UseCaseEvalPageState {
  advices?: readonly bayes.bob.Advice[]
  diagnostic?: bayes.bob.Diagnostic
  categories?: readonly bayes.bob.DiagnosticCategory[]
  evaluation?: bayes.bob.UseCaseEvaluation
  initialUseCaseId?: string
  isCreatePoolModalShown?: boolean
  isModified?: boolean
  isOverviewShown?: boolean
  isSaved?: boolean
  jobGroupInfo?: bayes.bob.JobGroup
  localStats?: bayes.bob.LocalJobStats
  pools?: readonly bayes.bob.UseCasePool[]
  selectedPoolName?: string
  selectedUseCase?: bayes.bob.UseCase
  shownPanel?: EvalPanel
  strategies?: readonly bayes.bob.Strategy[]
  useCases?: readonly bayes.bob.UseCase[]
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
  }

  public state: UseCaseEvalPageState = {
    advices: [],
    categories: [],
    diagnostic: null,
    evaluation: {},
    initialUseCaseId: null,
    isCreatePoolModalShown: false,
    isModified: false,
    isOverviewShown: false,
    isSaved: false,
    jobGroupInfo: null,
    localStats: null,
    pools: [],
    selectedPoolName: undefined,
    selectedUseCase: null,
    shownPanel: DIAGNOSTIC_PANEL,
    strategies: null,
    useCases: [],
  }

  public static getDerivedStateFromProps(
    {location: {search}, match: {params: {useCaseId}}}: UseCaseEvalPageProps,
    {selectedPoolName}: UseCaseEvalPageState): UseCaseEvalPageState {
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
      selectedPoolName: poolName,
    }
  }

  public componentDidMount(): void {
    const {dispatch} = this.props
    if (this.getUseCaseFromEmail()) {
      return
    }
    dispatch(getEvalUseCasePools()).then((pools: void|bayes.bob.UseCasePool[]): void => {
      if (!pools) {
        return
      }
      this.setState({
        pools,
        selectedPoolName: this.state.selectedPoolName ||
          (pools.length ? pools[0].name : undefined),
      }, this.fetchPoolUseCases)
    })
  }

  public componentWillUnmount(): void {
    this.isUnmounting = true
  }

  private isUnmounting = false

  private getUseCaseFromEmail(): boolean {
    const {dispatch, location: {search}} = this.props
    const {email, userId} = parse(search.substring(1))
    if (!email && !userId) {
      return false
    }
    dispatch(createUseCase({email, userId})).
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
    dispatch(getEvalUseCases(selectedPoolName)).then((useCases: bayes.bob.UseCase[]|void): void => {
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
    this.setState(({shownPanel}): UseCaseEvalPageState =>
      nextPanel === shownPanel ? {} : {shownPanel: nextPanel})
  })

  private advise = (): void => {
    const {dispatch} = this.props
    const {selectedUseCase} = this.state
    if (!selectedUseCase) {
      return
    }
    dispatch(getLaborStats(selectedUseCase.userData)).then((laborStats): void => {
      if (!laborStats || this.isUnmounting) {
        return
      }
      const {jobGroupInfo, localStats} = laborStats
      this.setState({jobGroupInfo, localStats})
    })
    dispatch(getAllCategories(selectedUseCase)).
      then((response: bayes.bob.DiagnosticCategories | void): void => {
        if (!response || this.isUnmounting) {
          return
        }
        this.setState({categories: response.categories})
      })
    // Compute the diagnostic.
    dispatch(diagnoseProject(selectedUseCase.userData)).
      // Set diagnostic on state and compute the advice modules.
      then((diagnostic: bayes.bob.Diagnostic|void): void => {
        if (!diagnostic || this.isUnmounting) {
          return
        }
        this.setState({diagnostic}, this.handleChoosePanel())
        const userWithDiagnostic = {
          ...selectedUseCase.userData,
          projects: [{
            ...selectedUseCase.userData.projects[0],
            diagnostic,
          }],
        }
        dispatch(computeAdvicesForProject(userWithDiagnostic)).
          then((response: bayes.bob.Advices|void): void => {
            if (this.isUnmounting || !response || !response.advices) {
              return
            }
            this.setState({advices: response.advices}, this.handleChoosePanel())
            const userWithAdviceAndDiagnostic = {
              ...selectedUseCase.userData,
              projects: [{
                ...selectedUseCase.userData.projects[0],
                advices: response.advices,
                diagnostic,
              }],
            }
            dispatch(strategizeProject(userWithAdviceAndDiagnostic)).
              then((response: bayes.bob.Strategies|void): void => {
                if (!response || this.isUnmounting) {
                  return
                }
                this.setState({strategies: response.strategies}, this.handleChoosePanel())
              })
          })
      })
  }

  private getUrlFromState(): string {
    const {selectedPoolName, selectedUseCase} = this.state
    const {match: {params: {useCaseId}}, location: {search}} = this.props
    const {email, poolName, userId} = parse(search)
    const selectedUseCaseId = selectedUseCase ? selectedUseCase.useCaseId : OVERVIEW_ID
    if (email || userId || poolName === selectedPoolName && selectedUseCaseId === useCaseId) {
      return null
    }
    const searchString = selectedPoolName ? `?poolName=${encodeURIComponent(selectedPoolName)}` : ''
    return `${Routes.EVAL_PAGE}/${selectedUseCaseId}${searchString}`
  }

  private selectUseCase = (selectedUseCase): void => {
    const {evaluation = {}, userData = null} = selectedUseCase || {}
    this.setState({
      advices: [],
      diagnostic: null,
      evaluation,
      isModified: false,
      isOverviewShown: false,
      isSaved: false,
      selectedUseCase,
    }, this.advise)
    this.props.dispatch({type: 'SELECT_USER', user: userData})
  }

  private handlePoolChange = (selectedPoolName: string): void => {
    this.setState({selectedPoolName}, this.fetchPoolUseCases)
  }

  private selectNextUseCase = (): void => {
    const {selectedUseCase, useCases} = this.state
    let nextUseCase = null
    useCases.forEach((useCase: bayes.bob.UseCase): void => {
      const indexInPool = useCase.indexInPool || 0
      if (indexInPool <= (selectedUseCase.indexInPool || 0)) {
        return
      }
      if (!nextUseCase || indexInPool < (nextUseCase.indexInPool || 0)) {
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
    const {useCaseId = undefined} = selectedUseCase || {}
    if (!useCaseId) {
      return
    }
    this.setState({
      // Let the pool know if the use case got evaluated for the first time.
      pools: selectedUseCase.evaluation ? pools : pools.map((pool): bayes.bob.UseCasePool => {
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
      selectedUseCase: null,
    })
    this.props.dispatch({type: 'SELECT_USER', user: null})
  }

  private handleRescoreAdvice = (adviceId: string, newScore: string): void => {
    const {evaluation} = this.state
    if (!newScore) {
      const modules = {...evaluation && evaluation.modules}
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

  private handleEvaluateAdvice = (adviceId: string, adviceEvaluation): void => {
    const {evaluation} = this.state
    const advices = evaluation.advices
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

  private handleEvaluateDiagnosticSection = (sectionId, sectionEvaluation): void => {
    const {evaluation} = this.state
    const diagnostic = evaluation.diagnostic
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

  private renderHeaderLink = ({name, panelId, predicate}): React.ReactNode => {
    if (!predicate(this.state)) {
      return null
    }
    const {shownPanel} = this.state
    const toggleTitleStyle = {
      ':hover': {
        borderBottom: `2px solid ${colors.BOB_BLUE_HOVER}`,
      },
      borderBottom: shownPanel === panelId ? `2px solid ${colors.BOB_BLUE}` : 'initial',
      paddingBottom: 5,
    }
    return <HeaderLink
      onClick={this.handleChoosePanel(panelId)} isSelected={shownPanel === panelId} key={panelId}>
      <span style={toggleTitleStyle}>{name}</span>
    </HeaderLink>
  }

  private updateEvaluation = (changes): void => {
    const {evaluation} = this.state
    this.setState({
      evaluation: {
        ...evaluation,
        ...changes,
      },
      isModified: true,
    })
  }

  private renderPanelContent(profile, project): React.ReactNode {
    const {advices, categories, diagnostic, jobGroupInfo, localStats, shownPanel,
      strategies} = this.state
    const fullProject = {
      ...project,
      advices,
      diagnostic,
      localStats,
      strategies,
    }
    switch (shownPanel) {
      case DIAGNOSTIC_PANEL:
        return <Assessment
          diagnostic={diagnostic || {}}
          diagnosticEvaluations={this.state.evaluation.diagnostic || {}}
          onEvaluateSection={this.handleEvaluateDiagnosticSection}
        />
      case ADVICE_PANEL:
        return <AdvicesRecap
          profile={profile} project={fullProject} advices={advices}
          adviceEvaluations={this.state.evaluation.advices || {}}
          onEvaluateAdvice={this.handleEvaluateAdvice}
          onRescoreAdvice={this.handleRescoreAdvice}
          moduleNewScores={this.state.evaluation.modules || {}}
        />
      case STRATEGIES_PANEL:
        // TODO(cyrille): Make sure we can see what's inside the strategies.
        return <Strategies
          makeStrategyLink={getEmptyString}
          project={fullProject}
          strategies={strategies || []} />
      case STATS_PANEL:
        return <Stats categories={categories} project={fullProject} jobGroupInfo={jobGroupInfo} />
    }
  }

  // TODO(cyrille): Move to its own component.
  private renderBobMindPanel(profile, project): React.ReactNode {
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
    const {evaluation, isOverviewShown, isModified, isSaved, pools, selectedPoolName,
      selectedUseCase, useCases} = this.state
    const poolOptions = pools.map(({evaluatedUseCaseCount, name, useCaseCount}): SelectOption => {
      const isPoolEvaluated = evaluatedUseCaseCount === useCaseCount
      return {
        name: (isPoolEvaluated ? '✅ ' : evaluatedUseCaseCount >= 10 ? '✓ ' : '🎯 ') + name,
        value: name,
      }
    })
    const overviewOption = {
      name: 'Sommaire',
      value: OVERVIEW_ID,
    }
    const useCasesOptions = [overviewOption].concat([...useCases].
      sort((a: bayes.bob.UseCase, b: bayes.bob.UseCase): number =>
        (a.indexInPool || 0) - (b.indexInPool || 0)).
      map(({indexInPool, title, useCaseId, userData, evaluation}): SelectOption => {
        return {
          name: (evaluation ? '✅ ' : '🎯 ') +
            (indexInPool || 0).toString() + ' - ' + getUseCaseTitle(title, userData),
          value: useCaseId,
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
        {selectedUseCase ? <UseCase useCase={selectedUseCase} /> : null}
        {isOverviewShown ? <PoolOverview
          useCases={useCases} onSelectUseCase={this.selectUseCase} /> : null}
      </div>
      <div style={centralPanelstyle}>
        {selectedUseCase ? this.renderBobMindPanel(profile, project) : null}
        {isOverviewShown ? null :
          <ScorePanel
            evaluation={evaluation}
            isModified={isModified}
            isSaved={isSaved}
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
  onClick: () => void
}


class ScoreButtonBase extends React.PureComponent<ScoreButtonProps> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    image: PropTypes.string.isRequired,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {children, image, isSelected, onClick} = this.props
    const containerStyle: RadiumCSSProperties = {
      ':hover': {
        opacity: 1,
      },
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      opacity: isSelected ? 1 : .5,
      padding: '25px 10px',
      textAlign: 'center',
    }
    return <div style={containerStyle} onClick={onClick}>
      <img src={image} alt="" style={{paddingBottom: 10}} /><br />
      {children}
    </div>
  }
}
const ScoreButton = Radium(ScoreButtonBase)


class ConceptEvalPage extends React.PureComponent {
  public render(): React.ReactNode {
    return <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column'}}>
      <UseCaseSelector />
      <CategoriesDistribution style={{maxWidth: 1000}} />
    </div>
  }
}


interface AuthEvalPageProps extends RouteComponentProps<{useCaseId: string}> {
  dispatch: DispatchAllEvalActions
  fetchGoogleIdToken: () => Promise<string>
}


interface AuthEvalPageState {
  hasAuthenticationFailed: boolean
}


class AuthenticateEvalPageBase extends React.PureComponent<AuthEvalPageProps, AuthEvalPageState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    fetchGoogleIdToken: PropTypes.func,
  }

  public state = {
    hasAuthenticationFailed: false,
  }

  private handleGoogleLogin = (googleUser): void => {
    const {dispatch} = this.props
    const googleIdToken = googleUser.getAuthResponse().id_token
    fetch('/api/eval/authorized', {
      headers: {'Authorization': 'Bearer ' + googleIdToken},
    }).then((response): void => {
      if (response.status >= 400 || response.status < 200) {
        this.handleGoogleFailure()
        return
      }
      dispatch({googleUser, type: 'AUTH'})
    })
  }

  private handleGoogleFailure = (): void => {
    this.setState({hasAuthenticationFailed: true})
  }

  private renderConceptPage = (): React.ReactNode => <ConceptEvalPage {...this.props} />

  private renderUseCasePage = (): React.ReactNode => <UseCaseEvalPage {...this.props} />

  public render(): React.ReactNode {
    const {fetchGoogleIdToken} = this.props
    if (fetchGoogleIdToken) {
      return <Switch>
        <Route path={Routes.CONCEPT_EVAL_PAGE} render={this.renderConceptPage} />
        <Route path="*" render={this.renderUseCasePage} />
      </Switch>
    }

    return <div style={{padding: 20, textAlign: 'center'}}>
      <GoogleLogin
        clientId={config.googleSSOClientId}
        isSignedIn={true}
        onSuccess={this.handleGoogleLogin}
        onFailure={this.handleGoogleFailure} />
      {this.state.hasAuthenticationFailed ? <div style={{margin: 20}}>
        L'authentification a échoué. L'accès à cet outil est restreint.<br />
        Contactez nous : contact@bob-emploi.fr
      </div> : null}
    </div>
  }
}
interface AuthEvalPageConnectedProps {
  fetchGoogleIdToken?: () => Promise<string>
}
const AuthenticateEvalPage = connect(({auth}: EvalRootState): AuthEvalPageConnectedProps => ({
  fetchGoogleIdToken: auth.fetchGoogleIdToken,
}))(AuthenticateEvalPageBase)



function fetchGoogleIdToken(googleUser): Promise<string> {
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


function evalUserReducer(state: bayes.bob.User = {}, action: AllEvalActions): bayes.bob.User {
  if (action.type === 'SELECT_USER') {
    return action.user
  }
  return state
}


const history = createBrowserHistory()

const ravenMiddleware = RavenMiddleware(config.sentryDSN, {release: config.clientVersion}, {
  stateTransformer: function(state: EvalRootState): {} {
    return {
      ...state,
      // Don't send user info to Sentry.
      user: 'Removed with ravenMiddleware stateTransformer',
    }
  },
})
// Enable devTools middleware.
const finalCreateStore = composeWithDevTools(
  // ravenMiddleware needs to be first to correctly catch exception down the line.
  applyMiddleware(ravenMiddleware, thunk, routerMiddleware(history)),
)(createStore)

// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(
  combineReducers({
    app,
    asyncState,
    auth: evalAuthReducer,
    router: connectRouter(history),
    user: evalUserReducer,
  })
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


class HeaderLinkBase extends React.PureComponent<HeaderLinkProps> {
  public static propTypes = {
    children: PropTypes.node,
    isSelected: PropTypes.bool,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, isSelected, style, ...extraProps} = this.props
    const containerStyle: React.CSSProperties = {
      cursor: 'pointer',
      fontSize: 15,
      fontWeight: isSelected ? 'bold' : 'initial',
      marginRight: 30,
      textAlign: 'center',
      width: 80,
      ...style,
    }
    return <span style={containerStyle} {...extraProps}>
      {children}
    </span>
  }
}
const HeaderLink = Radium(HeaderLinkBase)


interface ScorePanelProps {
  evaluation: bayes.bob.UseCaseEvaluation
  isModified: boolean
  isSaved: boolean
  onSave: () => void
  onUpdate: (value: bayes.bob.UseCaseEvaluation) => void
  selectNextUseCase: () => void
  style: React.CSSProperties
}


class ScorePanel extends React.PureComponent<ScorePanelProps> {
  public static propTypes = {
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

  private handleCommentChange = (comments): void => this.props.onUpdate({comments})

  private handleScoreUpdate = _memoize(
    (score: bayes.bob.UseCaseScore): (() => void) => (): void => this.props.onUpdate({score}))

  public render(): React.ReactNode {
    const {evaluation: {comments = '', score = ''}, onSave, isSaved,
      isModified, selectNextUseCase, style} = this.props
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      padding: '30px 30px 0px',
      ...style,
    }

    const savedMessageStyle = {
      fontSize: 12,
      opacity: (isSaved && !isModified) ? 1 : 0,
      ...SmoothTransitions,
    }

    const buttonsContainerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%',
    }
    return <div style={containerStyle}>
      <strong style={{alignSelf: 'flex-start', paddingBottom: 25}}>Évaluation</strong>
      <Textarea
        style={{minHeight: 100, width: '100%'}} value={comments || ''}
        placeholder="Commentaires"
        onChange={this.handleCommentChange} />
      <div style={buttonsContainerStyle}>
        <div style={{display: 'flex'}}>
          {EVAL_SCORES.map((level): React.ReactNode => <ScoreButton
            key={`${level.score}-button`}
            onClick={this.handleScoreUpdate(level.score)}
            isSelected={score === level.score} image={level.image}>
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
}


class App extends React.Component {
  public render(): React.ReactNode {
    return <Provider store={store}>
      <Radium.StyleRoot>
        <div style={{backgroundColor: colors.BACKGROUND_GREY, color: colors.DARK_TWO}}>
          <ConnectedRouter history={history}>
            <Route path={Routes.EVAL_PATH} component={AuthenticateEvalPage} />
          </ConnectedRouter>
          <Snackbar timeoutMillisecs={4000} />
        </div>
      </Radium.StyleRoot>
    </Provider>
  }
}


export {App}

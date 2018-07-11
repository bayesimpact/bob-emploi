import PropTypes from 'prop-types'
import {parse} from 'query-string'
import Radium from 'radium'
import React from 'react'
import GoogleLogin from 'react-google-login'
import {connect, Provider} from 'react-redux'
import {BrowserRouter, Route} from 'react-router-dom'
import {routerReducer} from 'react-router-redux'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'

import {computeAdvicesForProject, diagnoseProject, getEvalUseCasePools,
  getEvalUseCases} from 'store/actions'

import {app, asyncState} from 'store/app_reducer'
import {createProjectTitleComponents} from 'store/project'

import {Snackbar} from 'components/snackbar'
import {Button, SmoothTransitions} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'
import {Routes} from 'components/url'

import {AdvicesRecap} from './eval/advices_recap'
import {Assessment} from './eval/assessment'
import {CreatePoolModal} from './eval/create_pool_modal'
import {PoolOverview} from './eval/overview'
import {EVAL_SCORES} from './eval/score_levels'
import {UseCase} from './eval/use_case'

require('normalize.css')
require('styles/App.css')

const overviewId = 'sommaire'


function getUseCaseTitle(title, userData) {
  if (title) {
    return title
  }
  const {profile, projects} = userData
  if (!projects || !projects.length) {
    return ''
  }
  const project = projects[0]
  const {what, where} = createProjectTitleComponents(project, profile.gender)
  return `${what} ${where}`
}


class EvalPage extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    fetchGoogleIdToken: PropTypes.func.isRequired,
    location: PropTypes.shape({
      search: PropTypes.string.isRequired,
    }).isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        useCaseId: PropTypes.string,
      }).isRequired,
    }).isRequired,
  }

  static contextTypes = {
    history: PropTypes.shape({
      replace: PropTypes.func.isRequired,
    }).isRequired,
  }

  state = {
    advices: [],
    diagnostic: null,
    evaluation: {},
    initialUseCaseId: null,
    isAssessmentShown: true,
    isCreatePoolModalShown: false,
    isModified: false,
    isOverviewShown: false,
    isSaved: false,
    pools: [],
    selectedPoolName: undefined,
    selectedUseCase: null,
    useCases: [],
  }

  static getDerivedStateFromProps({location: {search}, match: {params}}, {selectedPoolName}) {
    if (selectedPoolName) {
      return null
    }
    const {poolName} = parse(search)
    if (!poolName) {
      return null
    }
    return {
      initialUseCaseId: params.useCaseId,
      selectedPoolName: poolName,
    }
  }

  componentDidMount() {
    const {dispatch} = this.props
    dispatch(getEvalUseCasePools()).then(pools => {
      this.setState({
        pools,
        selectedPoolName: this.state.selectedPoolName ||
          (pools.length ? pools[0].name : undefined),
      }, this.fetchPoolUseCases)
    })
  }

  componentWillUnmount() {
    this.isUnmounting = true
  }

  fetchPoolUseCases() {
    const {dispatch} = this.props
    const {initialUseCaseId, selectedPoolName} = this.state
    if (!selectedPoolName) {
      return
    }
    dispatch(getEvalUseCases(selectedPoolName)).then(useCases => {
      const initialUseCase = initialUseCaseId && useCases.find(
        ({useCaseId}) => useCaseId === initialUseCaseId)
      this.setState({
        isOverviewShown: initialUseCaseId === overviewId,
        useCases,
      })
      this.selectUseCase(initialUseCase || useCases.length && useCases[0] || null)
    })
  }

  advise = () => {
    const {dispatch} = this.props
    const {selectedUseCase} = this.state
    if (!selectedUseCase) {
      return
    }
    dispatch(computeAdvicesForProject(selectedUseCase.userData)).then(({advices}) => {
      if (!this.isUnmounting) {
        this.setState({advices: advices || []})
      }
    })
    dispatch(diagnoseProject(selectedUseCase.userData)).then(diagnostic => {
      if (!this.isUnmounting) {
        this.setState({diagnostic})
      }
    })
  }

  updateBrowserHistory(useCaseId, poolName) {
    if (poolName && useCaseId) {
      this.context.history.replace(
        Routes.EVAL_PAGE + '/' + useCaseId + '?poolName=' + encodeURIComponent(poolName))
    }
  }

  selectUseCase = selectedUseCase => {
    const {evaluation, poolName, useCaseId, userData} = selectedUseCase || {}
    this.setState({
      advices: [],
      diagnostic: null,
      evaluation: evaluation || {},
      isModified: false,
      isOverviewShown: false,
      isSaved: false,
      selectedUseCase,
    }, this.advise)
    this.props.dispatch({type: 'SELECT_USER', user: userData || null})
    this.updateBrowserHistory(useCaseId, poolName)
  }

  selectNextUseCase = () => {
    const {selectedUseCase, useCases} = this.state
    let nextUseCase = null
    useCases.forEach(useCase => {
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
      this.handleUseCaseChange(overviewId)
    }
  }

  handlePoolChange = selectedPoolName => {
    this.setState({selectedPoolName}, this.fetchPoolUseCases)
  }

  handleUseCaseChange = selectedUseCaseId => {
    if (selectedUseCaseId !== overviewId) {
      this.selectUseCase(
        this.state.useCases.find(({useCaseId}) => useCaseId === selectedUseCaseId))
      return
    }
    this.setState({
      isOverviewShown: true,
      selectedUseCase: null,
    })
    this.props.dispatch({type: 'SELECT_USER', user: null})
    const {poolName} = this.state.useCases.find(({poolName}) => poolName) || {}
    this.updateBrowserHistory(overviewId, poolName)
  }

  handleRescoreAdvice = (adviceId, newScore) => {
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

  handleEvaluateAdvice = (adviceId, adviceEvaluation) => {
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

  handleEvaluateDiagnosticSection = (sectionId, sectionEvaluation) => {
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

  handleSaveEval = () => {
    const {evaluation, pools, selectedPoolName, selectedUseCase, useCases} = this.state
    const {useCaseId} = selectedUseCase || {}
    if (!useCaseId) {
      return
    }
    this.setState({
      // Let the pool know if the use case got evaluated for the first time.
      pools: selectedUseCase.evaluation ? pools : pools.map(pool => {
        if (pool.name === selectedPoolName) {
          return {
            ...pool,
            evaluatedUseCaseCount: (pool.evaluatedUseCaseCount || 0) + 1,
          }
        }
        return pool
      }),
      useCases: useCases.map(useCase => {
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
      then(googleIdToken => fetch(`/api/eval/use-case/${useCaseId}`, {
        body: JSON.stringify(evaluation),
        headers: {
          'Authorization': 'Bearer ' + googleIdToken,
          'Content-Type': 'application/json',
        },
        method: 'post',
      })).
      then(() => {
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

  renderCreatePoolModal() {
    return <CreatePoolModal
      fetchGoogleIdToken={this.props.fetchGoogleIdToken}
      isShown={this.state.isCreatePoolModalShown}
      onClose={() => this.setState({isCreatePoolModalShown: false})} />
  }

  renderScorePanel() {
    const {evaluation, isModified, isSaved} = this.state
    const {comments, score} = evaluation
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
      flex: 0,
      flexDirection: 'column',
      marginLeft: 20,
      padding: 30,
      width: 350,
    }
    const updateEvaluation = changes => this.setState({
      evaluation: {
        ...evaluation,
        ...changes,
      },
      isModified: true,
    })
    const savedMessageStyle = {
      fontSize: 12,
      opacity: (isSaved && !isModified) ? 1 : 0,
      ...SmoothTransitions,
    }
    return <div style={containerStyle}>
      <strong>Évaluation</strong>
      <div style={{display: 'flex'}}>
        {EVAL_SCORES.map(level => <ScoreButton
          key={`${level.score}-button`}
          onClick={() => updateEvaluation({score: level.score})}
          isSelected={score === level.score} image={level.image}>
          {level.title}
        </ScoreButton>)}
      </div>
      <strong style={{marginBottom: 20}}>Commentaires</strong>
      <textarea
        style={{minHeight: 400, width: '100%'}} value={comments || ''}
        onChange={event => updateEvaluation({comments: event.target.value})} />
      <div style={{margin: '35px 0'}}>
        {isModified ?
          <Button type="validation" onClick={this.handleSaveEval}>Enregister</Button>
          :
          <Button type="navigation" onClick={this.selectNextUseCase}>Suivant</Button>
        }
      </div>
      <div style={savedMessageStyle}>
        Évaluation sauvegardée
      </div>
    </div>
  }

  renderAssessmentOrAdvicesPanel(profile, project) {
    const {advices, diagnostic, isAssessmentShown} = this.state
    const toggleStyle = {
      display: 'flex',
      flexDirection: 'row',
      marginBottom: 34,
    }
    const toggleTitleStyle = isSelected => {
      return {
        ':hover': {
          borderBottom: `2px solid ${colors.BOB_BLUE_HOVER}`,
        },
        borderBottom: isSelected ? `2px solid ${colors.BOB_BLUE}` : 'initial',
        paddingBottom: 5,
      }
    }
    return <div style={{backgroundColor: '#fff', flex: 1, padding: '25px 30px'}}>
      <div style={toggleStyle}>
        <HeaderLink
          onClick={() => this.setState({isAssessmentShown: true})}
          isSelected={isAssessmentShown}
        >
          <span style={toggleTitleStyle(isAssessmentShown)}>Diagnostic</span>
        </HeaderLink>
        <HeaderLink
          onClick={() => this.setState({isAssessmentShown: false})}
          isSelected={!isAssessmentShown}
        >
          <span style={toggleTitleStyle(!isAssessmentShown)}>Conseils</span>
        </HeaderLink>
      </div>
      {(isAssessmentShown && diagnostic) ?
        <Assessment
          diagnostic={diagnostic || {}}
          diagnosticEvaluations={this.state.evaluation.diagnostic || {}}
          onEvaluateSection={this.handleEvaluateDiagnosticSection}
        /> :
        <AdvicesRecap
          profile={profile} project={project} advices={advices}
          adviceEvaluations={this.state.evaluation.advices || {}}
          onEvaluateAdvice={this.handleEvaluateAdvice}
          onRescoreAdvice={this.handleRescoreAdvice}
          moduleNewScores={this.state.evaluation.modules || {}}
        />
      }
    </div>
  }

  render() {
    const {isOverviewShown, pools, selectedPoolName,
      selectedUseCase, useCases} = this.state
    const poolOptions = pools.map(({evaluatedUseCaseCount, name, useCaseCount}) => {
      const isPoolEvaluated = evaluatedUseCaseCount === useCaseCount
      return {
        name: (isPoolEvaluated ? '✅ ' : evaluatedUseCaseCount >= 10 ? '✓ ' : '🎯 ') + name,
        value: name,
      }
    })
    const overviewOption = {
      name: 'Sommaire',
      value: overviewId,
    }
    const useCasesOptions = [overviewOption].concat(useCases.
      sort((a, b) => (a.indexInPool || 0) - (b.indexInPool || 0)).
      map(({indexInPool, title, useCaseId, userData, evaluation}) => {
        return {
          name: (evaluation ? '✅ ' : '🎯 ') +
            (indexInPool || 0).toString() + ' - ' + getUseCaseTitle(title, userData),
          value: useCaseId,
        }
      }))
    const {useCaseId, userData} = selectedUseCase || {}
    const {profile, projects} = userData || {}
    const project = projects && projects.length && projects[0] || {}
    const style = {
      display: 'flex',
      flexDirection: 'row',
      padding: 20,
    }
    const letfBarStyle = {
      display: 'flex',
      flex: isOverviewShown ? 1 : 0,
      flexDirection: 'column',
      marginRight: 20,
      minWidth: 400,
      padding: 5,
    }
    return <div style={style}>
      {this.renderCreatePoolModal()}
      <div style={letfBarStyle}>
        <Select options={poolOptions} value={selectedPoolName}
          onChange={this.handlePoolChange} style={{backgroundColor: '#fff', marginBottom: 5}} />
        <Select options={useCasesOptions} value={useCaseId || undefined}
          onChange={this.handleUseCaseChange} style={{backgroundColor: '#fff'}} />
        <div style={{margin: '5px 0 10px', textAlign: 'center'}}>
          <Button onClick={() => this.setState({isCreatePoolModalShown: true})}>
            Créer un nouveau pool
          </Button>
        </div>
        {selectedUseCase ? <UseCase useCase={selectedUseCase} /> : null}
        {isOverviewShown ? <PoolOverview
          useCases={useCases} onSelectUseCase={this.selectUseCase} /> : null}
      </div>
      {selectedUseCase ? this.renderAssessmentOrAdvicesPanel(profile, project) : null}
      {isOverviewShown ? null : this.renderScorePanel()}
    </div>
  }
}


class ScoreButtonBase extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    image: PropTypes.string.isRequired,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
  }

  render() {
    const {children, image, isSelected, onClick} = this.props
    const containerStyle = {
      ':hover': {
        opacity: 1,
      },
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      opacity: isSelected ? 1 : .5,
      padding: '25px 20px',
      textAlign: 'center',
    }
    return <div style={containerStyle} onClick={onClick}>
      <img src={image} alt="" style={{paddingBottom: 10}} /><br />
      {children}
    </div>
  }
}
const ScoreButton = Radium(ScoreButtonBase)


class AuthenticateEvalPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    fetchGoogleIdToken: PropTypes.func,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
      replace: PropTypes.func.isRequired,
    }).isRequired,
  }

  static childContextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
      replace: PropTypes.func.isRequired,
    }).isRequired,
  }

  state = {
    hasAuthenticationFailed: false,
  }

  getChildContext() {
    const {history} = this.props
    return {history}
  }

  handleGoogleLogin = googleUser => {
    const {dispatch} = this.props
    const googleIdToken = googleUser.getAuthResponse().id_token
    fetch('/api/eval/authorized', {
      headers: {'Authorization': 'Bearer ' + googleIdToken},
    }).then(response => {
      if (response.status >= 400 || response.status < 200) {
        this.handleGoogleFailure()
        return
      }
      dispatch({googleUser, type: 'AUTH'})
    })
  }

  handleGoogleFailure = () => {
    this.setState({hasAuthenticationFailed: true})
  }

  render() {
    const {fetchGoogleIdToken} = this.props
    if (fetchGoogleIdToken) {
      return <EvalPage {...this.props} />
    }

    return <div style={{padding: 20, textAlign: 'center'}}>
      <GoogleLogin
        clientId={config.googleSSOClientId} offline={false}
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
const AuthenticateEvalPage = connect(({auth}) => ({
  fetchGoogleIdToken: auth.fetchGoogleIdToken,
}))(AuthenticateEvalPageBase)


function evalAuthReducer(state = {}, {googleUser, type}) {
  if (type === 'AUTH' && googleUser) {
    return {
      ...state,
      // TODO(pascal): Make it a bit smarter not to reload the response each time.
      fetchGoogleIdToken: () => googleUser.reloadAuthResponse().then(
        ({id_token: googleIdToken}) => googleIdToken),
    }
  }
  return state
}


function evalUserReducer(state = {}, action) {
  if (action.type === 'SELECT_USER') {
    return action.user
  }
  return state
}


const ravenMiddleware = RavenMiddleware(config.sentryDSN, {}, {
  stateTransformer: function(state) {
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
  applyMiddleware(ravenMiddleware, thunk),
)(createStore)

// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(
  combineReducers({
    app,
    asyncState,
    auth: evalAuthReducer,
    routing: routerReducer,
    user: evalUserReducer,
  })
)
if (module.hot) {
  module.hot.accept(['store/app_reducer'], () => {
    const {app, asyncState} = require('store/app_reducer')
    store.replaceReducer(combineReducers({
      app,
      asyncState,
      auth: evalAuthReducer,
      routing: routerReducer,
      user: evalUserReducer,
    }))
  })
}


class HeaderLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    isSelected: PropTypes.bool,
    style: PropTypes.object,
  }

  render() {
    const {children, isSelected, style, ...extraProps} = this.props
    const containerStyle = {
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


class App extends React.Component {
  render() {
    return <Provider store={store}>
      <Radium.StyleRoot>
        <div style={{backgroundColor: colors.BACKGROUND_GREY}}>
          <BrowserRouter>
            <Route path={Routes.EVAL_PATH} component={AuthenticateEvalPage} />
          </BrowserRouter>
          <Snackbar timeoutMillisecs={4000} />
        </div>
      </Radium.StyleRoot>
    </Provider>
  }
}


export {App, EvalPage}

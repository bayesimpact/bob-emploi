import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import GoogleLogin from 'react-google-login'
import {connect, Provider} from 'react-redux'
import {Router, Route, browserHistory} from 'react-router'
import {syncHistoryWithStore, routerReducer} from 'react-router-redux'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'

import config from 'config'

import {computeAdvicesForProject, getEvalUseCasePools, getEvalUseCases} from 'store/actions'

import {app} from 'store/app_reducer'
import {createProjectTitleComponents} from 'store/project'

import {Button, Colors, Select, SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'

import {AdvicesRecap} from './eval/advices_recap'
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
    googleIdToken: PropTypes.string.isRequired,
    location: PropTypes.shape({
      query: PropTypes.shape({
        poolName: PropTypes.string,
      }).isRequired,
    }).isRequired,
    params: PropTypes.shape({
      useCaseId: PropTypes.string,
    }),
  }

  state = {
    advices: [],
    evaluation: {},
    initialUseCaseId: null,
    isCreatePoolModalShown: false,
    isModified: false,
    isOverviewShown: false,
    isSaved: false,
    pools: [],
    selectedPoolName: undefined,
    selectedUseCase: null,
    useCases: [],
  }

  componentWillMount() {
    const {dispatch, location, params} = this.props
    dispatch(getEvalUseCasePools()).then(pools => {
      this.setState({
        pools,
        selectedPoolName: this.state.selectedPoolName ||
          (pools.length ? pools[0].name : undefined),
      }, this.fetchPoolUseCases)
    })
    if (location.query.poolName) {
      this.setState({
        initialUseCaseId: params && params.useCaseId,
        selectedPoolName: location.query.poolName,
      })
    }
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
  }

  updateBrowserHistory(useCaseId, poolName) {
    if (poolName && useCaseId) {
      // Sometimes this call might replace the current component by another one
      // and we lose everything.
      // TODO(pascal): Switch to a newer version of react-router so that we can
      // keep the same component.
      browserHistory.replace(
        Routes.EVAL_PAGE + '/' + useCaseId + '?poolName=' + encodeURIComponent(poolName))
    }
  }

  selectUseCase = selectedUseCase => {
    const {evaluation, poolName, useCaseId} = selectedUseCase || {}
    this.setState({
      advices: [],
      evaluation: evaluation || {},
      isModified: false,
      isOverviewShown: false,
      isSaved: false,
      selectedUseCase,
    }, this.advise)
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
    fetch(`/api/eval/use-case/${useCaseId}`, {
      body: JSON.stringify(evaluation),
      headers: {
        'Authorization': 'Bearer ' + this.props.googleIdToken,
        'Content-Type': 'application/json',
      },
      method: 'post',
    }).then(() => {
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
      googleIdToken={this.props.googleIdToken}
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

  render() {
    const {advices, isOverviewShown, pools, selectedPoolName,
      selectedUseCase, useCases} = this.state
    const poolOptions = pools.map(pool => {
      const isPoolEvaluated = pool.evaluatedUseCaseCount === pool.useCaseCount
      return {
        name: (isPoolEvaluated ? '✅ ' : '🎯 ') + pool.name,
        value: pool.name,
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
      {selectedUseCase ? <AdvicesRecap
        profile={profile} project={project} advices={advices}
        adviceEvaluations={this.state.evaluation.advices || {}}
        onEvaluateAdvice={this.handleEvaluateAdvice}
        onRescoreAdvice={this.handleRescoreAdvice}
        moduleNewScores={this.state.evaluation.modules || {}} /> : null}
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
    googleIdToken: PropTypes.string,
  }

  state = {
    hasAuthenticationFailed: false,
  }

  handleGoogleLogin = googleAuth => {
    const {dispatch} = this.props
    const email = googleAuth && googleAuth.getBasicProfile().getEmail()
    if (/@bayesimpact\.org$/.test(email)) {
      dispatch({googleIdToken: googleAuth.getAuthResponse().id_token, type: 'AUTH'})
      return
    }
    this.handleGoogleFailure()
  }

  handleGoogleFailure = () => {
    this.setState({hasAuthenticationFailed: true})
  }

  render() {
    const {googleIdToken, ...extraProps} = this.props
    if (googleIdToken) {
      return <EvalPage googleIdToken={googleIdToken} {...extraProps} />
    }

    return <div style={{padding: 20, textAlign: 'center'}}>
      <GoogleLogin
        clientId={config.googleSSOClientId} offline={false}
        isSignedIn={true}
        onSuccess={this.handleGoogleLogin}
        onFailure={this.handleGoogleFailure} />
      {this.state.hasAuthenticationFailed ? <div style={{margin: 20}}>
        Authentication failure. Access is restricted.
      </div> : null}
    </div>
  }
}
const AuthenticateEvalPage = connect(({user}) => ({
  googleIdToken: user.googleIdToken,
}))(AuthenticateEvalPageBase)


function evalUserReducer(state={}, action) {
  if (action.type === 'AUTH' && action.googleIdToken) {
    return {
      ...state,
      googleIdToken: action.googleIdToken,
    }
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
    routing: routerReducer,
    user: evalUserReducer,
  })
)

// Create an enhanced history that syncs navigation events with the store.
const history = syncHistoryWithStore(browserHistory, store)


class App extends React.Component {
  render() {
    if (!this.routesCache) {
      // Cache for the Routes: our routes are not dynamic, and the Hot Module
      // Replacement chokes on it when we do not render the exact same object,
      // so we cache it here.
      this.routesCache = <Router history={history}>
        <Route path={Routes.EVAL_PAGE} component={AuthenticateEvalPage} />
        <Route path={Routes.EVAL_PATH} component={AuthenticateEvalPage} />
      </Router>
    }
    return <Provider store={store}>
      <Radium.StyleRoot>
        <div style={{backgroundColor: Colors.BACKGROUND_GREY}}>
          {this.routesCache}
        </div>
      </Radium.StyleRoot>
    </Provider>
  }
}


export {App, EvalPage}

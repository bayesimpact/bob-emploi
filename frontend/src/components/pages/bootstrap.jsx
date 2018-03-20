import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect, Provider} from 'react-redux'
import {BrowserRouter, Route} from 'react-router-dom'
import {routerReducer} from 'react-router-redux'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'

import config from 'config'

import {computeAdvicesForProject, displayToasterMessage} from 'store/actions'
import {app, asyncState} from 'store/app_reducer'
import {inCityPrefix, lowerFirstLetter} from 'store/french'

import {Snackbar} from 'components/snackbar'
import {Colors} from 'components/theme'
import {Routes} from 'components/url'

import {AllAdviceSections} from './project/advice'

import 'normalize.css'
import 'styles/App.css'


class BootstrapPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
    }).isRequired,
    user: PropTypes.object.isRequired,
  }

  state = {
    advices: [],
  }

  componentWillMount() {
    const {dispatch, location} = this.props
    if (location.hash.length > 1) {
      const userJSON = decodeURIComponent(location.hash.substr(1))
      let user
      try {
        user = JSON.parse(userJSON)
      } catch (error) {
        dispatch(displayToasterMessage(`${error.message} en parsant ${userJSON}`))
        return
      }
      dispatch({type: 'SET_USER', user})
    }
  }

  componentWillReceiveProps(nextProps) {
    const {dispatch, user} = nextProps
    if (user.projects && !this.props.user.projects) {
      dispatch(computeAdvicesForProject(user)).then(({advices}) => this.setState({advices}))
    }
  }

  renderLocation({mobility}) {
    if (!mobility || !mobility.city || !mobility.city.name) {
      return null
    }
    const {cityName, prefix} = inCityPrefix(mobility.city.name)
    return ' ' + prefix + cityName
  }

  renderInJobGroup({targetJob}) {
    if (!targetJob || !targetJob.jobGroup || !targetJob.jobGroup.name) {
      return null
    }
    return ` en ${lowerFirstLetter(targetJob.jobGroup.name)}`
  }

  render() {
    const {user} = this.props
    const {advices} = this.state
    const project = (user.projects || []).find(p => p)
    if (!project || !advices) {
      return <div>Chargement…</div>
    }
    const {lastName, name} = user.profile || {}
    const headerStyle = {
      fontSize: 30,
      padding: 20,
      textAlign: 'center',
    }
    return <div>
      <header style={headerStyle}>
        Conseils pour le projet
        {(name && lastName) ? ` de ${name} ${lastName}` : null} de trouver un emploi
        {this.renderInJobGroup(project)}
        {this.renderLocation(project)}
      </header>
      <AllAdviceSections
        advices={advices} project={project} profile={user.profile} isShownAsFlat={true} />
    </div>
  }
}
const BootstrapPage = connect(({user}) => ({user}))(BootstrapPageBase)


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


function bootstrapUserReducer(state = {}, action) {
  if (action.type === 'SET_USER') {
    return action.user
  }
  return state
}


// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(
  combineReducers({
    app,
    asyncState,
    routing: routerReducer,
    user: bootstrapUserReducer,
  })
)
if (module.hot) {
  module.hot.accept(['store/app_reducer'], () => {
    const {app, asyncState} = require('store/app_reducer')
    store.replaceReducer(combineReducers({
      app,
      asyncState,
      routing: routerReducer,
      user: bootstrapUserReducer,
    }))
  })
}


class App extends React.Component {
  render() {
    return <Provider store={store}>
      <Radium.StyleRoot>
        <div style={{backgroundColor: Colors.BACKGROUND_GREY}}>
          <BrowserRouter>
            <Route path={Routes.BOOTSTRAP_PAGE} component={BootstrapPage} />
          </BrowserRouter>
          <Snackbar timeoutMillisecs={4000} />
        </div>
      </Radium.StyleRoot>
    </Provider>
  }
}


export {App}

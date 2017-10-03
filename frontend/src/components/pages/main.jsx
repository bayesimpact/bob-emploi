import React from 'react'
import PropTypes from 'prop-types'
import _ from 'underscore'
import {parse} from 'query-string'
import {connect, Provider} from 'react-redux'
import createHistory from 'history/createBrowserHistory'
import {Redirect, Route, Switch} from 'react-router-dom'
import {ConnectedRouter, routerReducer, routerMiddleware} from 'react-router-redux'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import thunk from 'redux-thunk'
import RavenMiddleware from 'redux-raven-middleware'
import Snackbar from 'material-ui/Snackbar'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import {StyleRoot} from 'radium'
import {composeWithDevTools} from 'redux-devtools-extension'
import Cookies from 'js-cookie'
import {polyfill} from 'smoothscroll-polyfill'
import {Routes} from 'components/url'
import {Colors} from 'components/theme'
import {CookiesPage} from './cookies'
import {LandingPage} from './landing'
import {NewProjectPage} from './new_project'
import {ProfilePage} from './profile'
import {ProjectPage} from './project'
import {DashboardExportPage} from './dashboard_export'
import {PrivacyPage} from './privacy'
import {ProfessionalsPage} from './professionals'
import {VideoSignUpPage} from './signup'
import {TransparencyPage} from './transparency'
import {TeamPage} from './team'
import {TermsAndConditionsPage} from './terms'
import {UpdatePage} from './update'
import {VisionPage} from './vision'
import {WaitingPage} from './waiting'
import {ContributionPage} from './contribution'
import {LoginModal} from 'components/login'
import {AppNotAvailablePage} from './app_not_available'

import {isOnSmallScreen} from 'store/mobile'
import {user} from 'store/user_reducer'
import {actionTypesToLog, hideToasterMessageAction, fetchUser, logoutAction,
  openLoginModal, switchToMobileVersionAction, migrateUserToAdvisor,
  trackInitialUtmContent} from 'store/actions'
import {app, asyncState} from 'store/app_reducer'
import {mainSelector, onboardingComplete} from 'store/main_selectors'
import {createAmplitudeMiddleware} from 'store/amplitude'
import {createPageviewTracker} from 'store/google_analytics'
import config from 'config'

require('normalize.css')
require('styles/App.css')

polyfill()

const history = createHistory()

const ravenMiddleware = RavenMiddleware(config.sentryDSN, {}, {
  stateTransformer: function(state) {
    return {
      ...state,
      // Don't send user info to Sentry.
      user: 'Removed with ravenMiddleware stateTransformer',
    }
  },
})
const amplitudeMiddleware = createAmplitudeMiddleware(actionTypesToLog)
// Enable devTools middleware.
const finalCreateStore = composeWithDevTools(
  // ravenMiddleware needs to be first to correctly catch exception down the line.
  applyMiddleware(ravenMiddleware, thunk, amplitudeMiddleware, routerMiddleware(history)),
)(createStore)

// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(
  combineReducers({
    app,
    asyncState,
    routing: routerReducer,
    user,
  })
)
if (module.hot) {
  module.hot.accept(['store/user_reducer', 'store/app_reducer'], () => {
    const nextAppReducerModule = require('store/app_reducer')
    store.replaceReducer(combineReducers({
      app: nextAppReducerModule.app,
      asyncState: nextAppReducerModule.asyncState,
      routing: routerReducer,
      user: require('store/user_reducer').user,
    }))
  })
}


// Connect pages that needs it to the main store.
// TODO(pascal): Move those to their respective files.
const ConnectedLandingPage = connect(mainSelector)(LandingPage)
const ConnectedProfilePage = connect(mainSelector)(ProfilePage)
const ConnectedProjectPage = connect(mainSelector)(ProjectPage)
const ConnectedProfessionalsPage = connect(mainSelector)(ProfessionalsPage)


// Pages that need to know whether a user is present or not. This component
// will try to login the user if there's a clue (in the cookies or in the URL),
// but not enforce it.
class UserCheckedPagesBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      pathname: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }).isRequired,
    user: PropTypes.shape({
      userId: PropTypes.string,
    }).isRequired,
  }

  state = {
    isFetchingUser: false,
    isResettingPassword: false,
  }

  componentWillMount() {
    const {user, dispatch, location} = this.props
    const {email, resetToken, userId} = parse(location.search)
    const userIdFromUrl = userId
    const userIdFromCookie = Cookies.get('userId')

    // Reset password flow: disregard any page and just let the user reset
    // their password.
    if (resetToken) {
      this.setState({isResettingPassword: true})
      dispatch(openLoginModal({
        email: email || '',
        resetToken,
      }, 'resetpassword'))
      return
    }

    if (!userIdFromUrl && (user.userId || !userIdFromCookie)) {
      return
    }

    this.setState({isFetchingUser: true})
    // URL has priority over cookie.
    dispatch(fetchUser(userIdFromUrl || userIdFromCookie, !userIdFromUrl)).then(() => {
      this.setState({isFetchingUser: false})
    }, () => {
      dispatch(openLoginModal({
        email: email || '',
      }, 'returninguser'))
      this.setState({isFetchingUser: false})
    })
  }

  componentWillReceiveProps(nextProps) {
    const {dispatch, user} = nextProps
    if (!user.userId || user.userId === this.props.user.userId) {
      return
    }
    if (user.appNotAvailable) {
      dispatch(logoutAction)
      return
    }
    if (!this.isAdvisorUser(user)) {
      dispatch(migrateUserToAdvisor())
    }
  }

  isAdvisorUser(user) {
    const {advisor, switchedFromMashupToAdvisor} = user.featuresEnabled || {}
    return advisor && (user.projects || []).length <= 1 || switchedFromMashupToAdvisor
  }

  render() {
    const {location, user} = this.props
    const {hash, search} = location
    const hasUser = !!user.userId
    return <div>
      <Switch>
        {/* Pages that can be access both for logged-in and anonymous users. */}
        <Route path={Routes.APP_NOT_AVAILABLE_PAGE} component={AppNotAvailablePage} />
        <Route path={Routes.CONTRIBUTION_PAGE} component={ContributionPage} />
        <Route path={Routes.COOKIES_PAGE} component={CookiesPage} />
        <Route path={Routes.PRIVACY_PAGE} component={PrivacyPage} />
        <Route path={Routes.TRANSPARENCY_PAGE} component={TransparencyPage} />
        <Route path={Routes.TEAM_PAGE} component={TeamPage} />
        <Route path={Routes.PROFESSIONALS_PAGE} component={ConnectedProfessionalsPage} />
        <Route path={Routes.VIDEO_SIGNUP_PAGE} component={VideoSignUpPage} />
        <Route path={Routes.TERMS_AND_CONDITIONS_PAGE} component={TermsAndConditionsPage} />
        <Route path={Routes.VISION_PAGE} component={VisionPage} />

        {/* Special states. */}
        {this.state.isFetchingUser ? <Route path="*" component={WaitingPage} /> : null}
        {this.state.isResettingPassword ?
          <Route path="*" component={ConnectedLandingPage} /> : null}
        {user.appNotAvailable ? <Redirect to={Routes.APP_NOT_AVAILABLE_PAGE} /> : null}

        {/* Landing page for anonymous users. */}
        {hasUser ? null : <Route path="*" component={ConnectedLandingPage} />}

        {/* Pages for logged-in users that might not have completed their onboarding. */}
        <Route path={Routes.PROFILE_ONBOARDING_PAGES} component={ConnectedProfilePage} />
        <Route path={Routes.NEW_PROJECT_ONBOARDING_PAGES} component={NewProjectPage} />
        <Route path={Routes.APP_UPDATED_PAGE} component={UpdatePage} />

        {/* Redirect if user is not fully ready. */}
        {this.isAdvisorUser(user) ? null : <Redirect to={Routes.APP_UPDATED_PAGE} />}
        {onboardingComplete(user) ? null : <Redirect to={Routes.PROFILE_PAGE} />}

        {/* Pages for logged-in user that have completed their onboarding. */}
        <Route path={Routes.PROJECT_PATH} component={ConnectedProjectPage} />
        <Redirect to={Routes.PROJECT_PAGE + search + hash} />
      </Switch>
      <LoginModal onLogin={() => this.setState({isResettingPassword: false})} />
    </div>
  }
}
const UserCheckedPages = connect(mainSelector)(UserCheckedPagesBase)


// The main layout containing any page. Especially it handles the error message
// bar.
class PageHolderBase extends React.Component {
  static propTypes = {
    asyncState: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
      replace: PropTypes.func.isRequired,
    }).isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      pathname: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }),
  }

  static childContextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
      replace: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool,
  }

  constructor(props) {
    super(props)
    this.state = {
      initialLocation: props.location,
      isMobileVersion: isOnSmallScreen(),
    }
    this.pageviewTracker = createPageviewTracker()
  }

  getChildContext() {
    const {isMobileVersion} = this.state
    const {history} = this.props
    return {history, isMobileVersion}
  }

  componentWillMount() {
    const query = parse(this.props.location)
    const utmContent = query['utm_content'] || ''
    if (utmContent) {
      this.props.dispatch(trackInitialUtmContent(utmContent))
    }
    if (this.state.isOnSmallScreen) {
      this.props.dispatch(switchToMobileVersionAction)
      document.getElementById('viewport').setAttribute('content', 'width=320')
    }
    const updatedPath = this.removeAmpersandDoubleEncoding()
    if (updatedPath) {
      history.replace(updatedPath)
    }
  }

  componentDidUpdate(prevProps) {
    const {location} = this.props
    if (prevProps.location.pathname !== location.pathname) {
      window.scrollTo(0, 0)
      this.pageviewTracker(location)
    }
  }

  removeAmpersandDoubleEncoding() {
    const {hash, pathname, search} = this.props.location
    const query = parse(search)
    if (!Object.keys(query).some(key => /^amp;/.test(key))) {
      return ''
    }
    return pathname + '?' + _.map(query, (value, key) =>
      encodeURIComponent(key.replace(/^amp;/, '')) + '=' +
      encodeURIComponent(value)).join('&') + hash
  }

  hideToasterMessage() {
    return () => this.props.dispatch(hideToasterMessageAction)
  }

  render () {
    const errorMessage = this.props.asyncState.errorMessage
    return <MuiThemeProvider>
      <StyleRoot>
        <div style={{backgroundColor: Colors.BACKGROUND_GREY}}>
          <Switch>
            <Route path={Routes.DASHBOARD_EXPORT} component={DashboardExportPage} />
            <Route path="/" component={UserCheckedPages} />
          </Switch>
          <Snackbar
            open={!!errorMessage} message={errorMessage || ''}
            bodyStyle={{maxWidth: 800}}
            autoHideDuration={4000} onRequestClose={this.hideToasterMessage()} />
        </div>
      </StyleRoot>
    </MuiThemeProvider>
  }
}
const PageHolder = connect(mainSelector)(PageHolderBase)


class App extends React.Component {
  render() {
    // The Provider puts the store on a `Context`, so we can connect other
    // components to it.
    return <Provider store={store}>
      <ConnectedRouter history={history}>
        <Route path="/" component={PageHolder} />
      </ConnectedRouter>
    </Provider>
  }
}


export {App}

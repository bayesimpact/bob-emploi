import React from 'react'
import PropTypes from 'prop-types'
import _ from 'underscore'
import {connect, Provider} from 'react-redux'
import {IndexRoute, Redirect, Router, Route, browserHistory} from 'react-router'
import {syncHistoryWithStore, routerReducer} from 'react-router-redux'
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
import {AdvicePage} from './advice'
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
  applyMiddleware(ravenMiddleware, thunk, amplitudeMiddleware),
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
// TODO(pascal): Hot reload the store as well, see
// https://github.com/reactjs/react-redux/releases/tag/v2.0.0.

// Create an enhanced history that syncs navigation events with the store.
const history = syncHistoryWithStore(browserHistory, store)

// The main layout containing any page. Especially it handles the error message
// bar and the login modal.
class PageHolderBase extends React.Component {
  static propTypes = {
    asyncState: PropTypes.object.isRequired,
    children: PropTypes.node,
    dispatch: PropTypes.func.isRequired,
    routing: PropTypes.object.isRequired,
    user: PropTypes.object.isRequired,
  }

  static childContextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  constructor(props) {
    super(props)
    this.state = {
      isMobileVersion: isOnSmallScreen(),
    }
  }

  getChildContext() {
    const {isMobileVersion} = this.state
    return {isMobileVersion}
  }

  componentWillMount() {
    const {query} = this.props.routing.locationBeforeTransitions
    const utmContent = query['utm_content'] || ''
    if (utmContent) {
      this.props.dispatch(trackInitialUtmContent(utmContent))
    }
    if (this.state.isOnSmallScreen) {
      this.props.dispatch(switchToMobileVersionAction)
      document.getElementById('viewport').setAttribute('content', 'width=320')
    }
  }

  componentDidMount() {
    const {user, dispatch, routing} = this.props
    const location = routing.locationBeforeTransitions
    const userIdFromUrl = location && location.query && location.query.userId
    const userIdFromCookie = Cookies.get('userId')
    if (location.pathname.startsWith(Routes.DASHBOARD_EXPORT_FOLDER)) {
      return
    }
    const resetToken = location && location.query && location.query.resetToken
    if (resetToken) {
      dispatch(openLoginModal({
        email: location.query.email || '',
        resetToken,
      }, 'resetpassword'))
      return
    }
    if (!user.userId && userIdFromCookie || userIdFromUrl) {
      // URL has priority over cookie.
      dispatch(fetchUser(userIdFromUrl || userIdFromCookie, !userIdFromUrl)).then(() => {
        this.handleLogin(this.props.user)
      }, () => {
        // Login failed. Send them to landing page for login/signup.
        browserHistory.replace(Routes.ROOT)
        dispatch(openLoginModal({
          email: location.query.email || '',
        }, 'returninguser'))
      })
    }
  }

  hideToasterMessage() {
    return () => this.props.dispatch(hideToasterMessageAction)
  }

  handleLogin = user => {
    if (!onboardingComplete(user)) {
      browserHistory.push(Routes.PROFILE_PAGE)
      return
    }
    const featuresEnabled = user.featuresEnabled || {}
    if ((!featuresEnabled.advisor || (user.projects || []).length > 1) &&
      !featuresEnabled.switchedFromMashupToAdvisor) {
      browserHistory.push(Routes.APP_UPDATED_PAGE)
      this.props.dispatch(migrateUserToAdvisor())
      return
    }
    const location = this.props.routing.locationBeforeTransitions
    // The `nextPathName` might be set by `requireAuthAndDesktop`, to remember
    // where a user wanted to go before we knew whether they are logged in or
    // not.
    const hash = location.state && location.state.nextHash || ''
    const route = location.state && location.state.nextPathname || location.pathname
    if (route === Routes.ROOT) {
      browserHistory.replace(Routes.PROJECT_PAGE + hash)
      return
    }
    browserHistory.replace(route + hash)
  }

  render () {
    const errorMessage = this.props.asyncState.errorMessage
    return (
      <MuiThemeProvider>
        <StyleRoot>
          <div style={{backgroundColor: Colors.BACKGROUND_GREY}}>
            {this.props.children}
            <LoginModal onLogin={this.handleLogin} />
            <Snackbar
              open={!!errorMessage} message={errorMessage || ''}
              bodyStyle={{maxWidth: 800}}
              autoHideDuration={4000} onRequestClose={this.hideToasterMessage()} />
          </div>
        </StyleRoot>
      </MuiThemeProvider>
    )
  }
}

const PageHolder = connect(mainSelector)(PageHolderBase)


class HomePage extends React.Component {
  static propTypes = {
    user: PropTypes.object.isRequired,
  }

  render() {
    const {user} = this.props
    if (onboardingComplete(user)) {
      return <ProjectPage {...this.props} />
    }
    return <LandingPage {...this.props} />
  }
}


class MyRouterBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
  }

  isUserMissing = () => {
    const {user} = this.props
    return !user.userId
  }

  requireAuthAndDesktop = (nextRouterState, replace) => {
    const {dispatch, user} = this.props
    // TODO: Also check if we got a userId from the URL.
    // We cannot expect to get a user.
    if (!Cookies.get('userId')) {
      replace({
        pathname: Routes.ROOT,
        state: {
          nextHash: nextRouterState.location.hash,
          nextPathname: nextRouterState.location.pathname,
        },
      })
      dispatch(openLoginModal({
        email: nextRouterState.location.query.email || '',
      }), 'accessurl')
      return
    }
    // We don't know anything about the user yet (waiting for backend).
    if (this.isUserMissing()) {
      replace({
        pathname: Routes.WAITING_PAGE,
        state: {
          nextHash: nextRouterState.location.hash,
          nextPathname: nextRouterState.location.pathname,
        },
      })
      return
    }
    if (user.appNotAvailable) {
      replace({pathname: Routes.APP_NOT_AVAILABLE_PAGE})
      dispatch(logoutAction)
    }

    if (!onboardingComplete(user) &&
        !nextRouterState.location.pathname.startsWith(Routes.PROFILE_PAGE)) {
      replace({pathname: Routes.PROFILE_PAGE})
      return
    }
  }

  removeAmpersandDoubleEncoding = (nextRouterState, replace) => {
    const {query} = nextRouterState.location
    if (!Object.keys(query).some(key => /^amp;/.test(key))) {
      return false
    }
    replace({
      ...nextRouterState.location,
      query: _.object(_.map(query, (value, key) => [key.replace(/^amp;/, ''), value])),
    })
    return true
  }

  // TODO: Factor with requireAuthAndDesktop and rethink the whole access handling.
  requireUserCheck = (nextRouterState, replace) => {
    if (this.removeAmpersandDoubleEncoding(nextRouterState, replace)) {
      return
    }
    // TODO: Also check if we got a userId from the URL.
    // We don't know anything about the user yet (waiting for backend).
    if (this.isUserMissing() && Cookies.get('userId')) {
      if (nextRouterState.location.pathname !== Routes.WAITING_PAGE) {
        replace({
          pathname: Routes.WAITING_PAGE,
          state: {
            nextHash: nextRouterState.location.hash,
            nextPathname: nextRouterState.location.pathname,
          },
        })
      }
      return
    }
  }

  render() {
    const mainConnect = connect(mainSelector)
    if (!this.routesCache) {
      const trackPageview = createPageviewTracker()
      // Cache for the Routes: our routes are not dynamic, and the Hot Module
      // Replacement chokes on it when we do not render the exact same object,
      // so we cache it here.
      this.routesCache = <Router
        history={history} onUpdate={() => {
          window.scrollTo(0, 0)
          trackPageview()
        }}
        createElement={this.createElement}>
        <Route path={Routes.ROOT} component={PageHolder}>
          <Route path={Routes.DASHBOARD_EXPORT} component={DashboardExportPage} />
          <Route onEnter={this.requireUserCheck}>
            <IndexRoute component={mainConnect(HomePage)} />
            <Route path={Routes.APP_NOT_AVAILABLE_PAGE} component={AppNotAvailablePage} />
            <Route path={Routes.CONTRIBUTION_PAGE} component={mainConnect(ContributionPage)} />
            <Route path={Routes.COOKIES_PAGE} component={CookiesPage} />
            <Route path={Routes.PRIVACY_PAGE} component={PrivacyPage} />
            <Route path={Routes.TRANSPARENCY_PAGE} component={mainConnect(TransparencyPage)} />
            <Route path={Routes.PROFESSIONALS_PAGE} component={mainConnect(ProfessionalsPage)} />
            <Route path={Routes.VIDEO_SIGNUP_PAGE} component={VideoSignUpPage} />
            <Route path={Routes.TERMS_AND_CONDITIONS_PAGE} component={TermsAndConditionsPage} />
            <Route path={Routes.VISION_PAGE} component={mainConnect(VisionPage)} />
            <Route path={Routes.WAITING_PAGE} component={WaitingPage} />
            <Route onEnter={this.requireAuthAndDesktop}>
              <Route path={Routes.PROFILE_PAGE} component={mainConnect(ProfilePage)} />
              <Route path={Routes.PROFILE_ONBOARDING_PAGES} component={mainConnect(ProfilePage)} />
              <Route path={Routes.NEW_PROJECT_PAGE} component={NewProjectPage} />
              <Route path={Routes.NEW_PROJECT_ONBOARDING_PAGES} component={NewProjectPage} />
              <Route path={Routes.PROJECT_PAGE} component={mainConnect(ProjectPage)} />
              <Route path={Routes.PROJECT_PATH} component={mainConnect(ProjectPage)} />
              <Route path={Routes.ADVICE_PATH} component={mainConnect(AdvicePage)} />
              <Route path={Routes.APP_UPDATED_PAGE} component={UpdatePage} />
              <Redirect from="*" to={Routes.PROJECT_PAGE} />
            </Route>
          </Route>
        </Route>
      </Router>
    }
    return this.routesCache
  }
}
const MyRouter = connect(({user}) => ({user}))(MyRouterBase)


class App extends React.Component {
  render() {
    // The Provider puts the store on a `Context`, so we can connect other
    // components to it.
    return <Provider store={store}>
      <MyRouter />
    </Provider>
  }
}


export {App}

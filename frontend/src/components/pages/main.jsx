import createHistory from 'history/createBrowserHistory'
import Cookies from 'js-cookie'
import map from 'lodash/map'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import {StyleRoot} from 'radium'
import React from 'react'
import {connect, Provider} from 'react-redux'
import {Redirect, Route, Switch} from 'react-router-dom'
import {ConnectedRouter, routerReducer, routerMiddleware} from 'react-router-redux'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'
import {polyfill} from 'smoothscroll-polyfill'

import {LoginModal} from 'components/login'
import {Snackbar} from 'components/snackbar'
import {STATIC_ADVICE_MODULES} from 'components/static_advice'
import {Colors} from 'components/theme'
import {Routes} from 'components/url'
import {AppNotAvailablePage} from './app_not_available'
import {ContributionPage} from './contribution'
import {CookiesPage} from './cookies'
import {DashboardExportPage} from './dashboard_export'
import {LandingPage} from './landing'
import {NewProjectPage} from './new_project'
import {ProfilePage} from './profile'
import {ProjectPage} from './project'
import {PrivacyPage} from './privacy'
import {ProfessionalsPage} from './professionals'
import {VideoSignUpPage} from './signup'
import {TeamPage} from './team'
import {TermsAndConditionsPage} from './terms'
import {TransparencyPage} from './transparency'
import {UpdatePage} from './update'
import {VisionPage} from './vision'
import {WaitingPage} from './waiting'

import {actionTypesToLog, fetchUser, logoutAction, openLoginModal, switchToMobileVersionAction,
  migrateUserToAdvisor, trackInitialUtm, activateDemoInFuture, activateDemo,
  loginUserFromToken} from 'store/actions'
import {createAmplitudeMiddleware} from 'store/amplitude'
import {app, asyncState} from 'store/app_reducer'
import {createPageviewTracker} from 'store/google_analytics'
import {onboardingComplete} from 'store/main_selectors'
import {isOnSmallScreen} from 'store/mobile'
import {userReducer} from 'store/user_reducer'

import config from 'config'

require('normalize.css')
require('styles/App.css')

polyfill()


// Pages that need to know whether a user is present or not. This component
// will try to login the user if there's a clue (in the cookies or in the URL),
// but not enforce it.
class UserCheckedPagesBase extends React.Component {
  static propTypes = {
    demo: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    hasUserSeenExplorer: PropTypes.bool.isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      pathname: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }).isRequired,
    user: PropTypes.shape({
      userId: PropTypes.string,
    }).isRequired,
  }

  static contextTypes = {
    history: PropTypes.shape({
      replace: PropTypes.func.isRequired,
    }).isRequired,
  }

  state = {
    isFetchingUser: false,
    isResettingPassword: false,
  }

  componentWillMount() {
    const {user, dispatch, location} = this.props
    const {authToken, email, resetToken, userId: userIdFromUrl} = parse(location.search)
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
    const fetchUserAction = (authToken && userIdFromUrl) ?
      loginUserFromToken(userIdFromUrl, authToken) :
      fetchUser(userIdFromUrl || userIdFromCookie, !userIdFromUrl)

    dispatch(fetchUserAction).then(() => {
      this.setState({isFetchingUser: false})
    }, () => {
      dispatch(openLoginModal({
        email: email || '',
      }, 'returninguser'))
      this.setState({isFetchingUser: false})
    })
  }

  componentWillReceiveProps(nextProps) {
    const {demo, dispatch, user: {appNotAvailable, userId}} = nextProps
    if (!userId || userId === this.props.user.userId) {
      return
    }
    if (demo) {
      dispatch(activateDemo(demo))
    }
    if (appNotAvailable) {
      dispatch(logoutAction)
      return
    }
    if (!this.isAdvisorUser(nextProps.user)) {
      dispatch(migrateUserToAdvisor())
    }
  }

  isAdvisorUser(user) {
    const {advisor, switchedFromMashupToAdvisor} = user.featuresEnabled || {}
    return advisor && (user.projects || []).length <= 1 || switchedFromMashupToAdvisor
  }

  render() {
    const {hasUserSeenExplorer, location, user} = this.props
    const {history} = this.context
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
        <Route path={Routes.PROFESSIONALS_PAGE} component={ProfessionalsPage} />
        <Route path={Routes.VIDEO_SIGNUP_PAGE} component={VideoSignUpPage} />
        <Route path={Routes.TERMS_AND_CONDITIONS_PAGE} component={TermsAndConditionsPage} />
        <Route path={Routes.VISION_PAGE} component={VisionPage} />
        {STATIC_ADVICE_MODULES.map(({Page, adviceId}) =>
          <Route
            path={`${Routes.STATIC_ADVICE_PATH}/${adviceId}`} component={Page} key={adviceId} />
        )}

        {/* Special states. */}
        {this.state.isFetchingUser ? <Route path="*" component={WaitingPage} /> : null}
        {this.state.isResettingPassword ?
          <Route path="*" component={LandingPage} /> : null}
        {user.appNotAvailable ? <Redirect to={Routes.APP_NOT_AVAILABLE_PAGE} /> : null}

        {/* Landing page for anonymous users. */}
        {hasUser ? null : <Route path={Routes.JOB_SIGNUP_PAGE} component={LandingPage} />}
        {hasUser ? null : <Route path="*" component={LandingPage} />}

        {/* Pages for logged-in users that might not have completed their onboarding. */}
        <Route path={Routes.PROFILE_ONBOARDING_PAGES} component={ProfilePage} />
        <Route path={Routes.NEW_PROJECT_ONBOARDING_PAGES} component={NewProjectPage} />
        <Route path={Routes.APP_UPDATED_PAGE} component={UpdatePage} />

        {/* Redirect if user is not fully ready. */}
        {this.isAdvisorUser(user) && hasUserSeenExplorer ? null :
          <Redirect to={Routes.APP_UPDATED_PAGE} />}
        {onboardingComplete(user) ? null : <Redirect to={Routes.PROFILE_PAGE} />}

        {/* Pages for logged-in user that have completed their onboarding. */}
        <Route path={Routes.PROJECT_PATH} component={ProjectPage} />
        <Redirect to={Routes.PROJECT_PAGE + search + hash} />
      </Switch>
      <LoginModal onLogin={() => {
        this.setState({isResettingPassword: false})
        history.replace(Routes.ROOT)
      }} />
    </div>
  }
}
const UserCheckedPages = connect(({app, user}) => ({
  demo: app.demo,
  hasUserSeenExplorer: !app.lastAccessAt || app.lastAccessAt > '2018-01-17',
  user,
}))(UserCheckedPagesBase)


// The main layout containing any page. Especially it handles the error message
// bar.
class PageHolderBase extends React.Component {
  static propTypes = {
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
    const {dispatch, location: {search}} = this.props
    if (search) {
      this.handleSearchParamsUpdated(search)
    }
    if (this.state.isMobileVersion) {
      dispatch(switchToMobileVersionAction)
      document.getElementById('viewport').setAttribute('content', 'width=320')
    }
  }

  componentWillReceiveProps(nextProps) {
    const {location: {search}} = nextProps
    if (this.props.location.search !== search) {
      this.handleSearchParamsUpdated(search)
    }
  }

  componentDidUpdate(prevProps) {
    const {location} = this.props
    if (prevProps.location.pathname !== location.pathname) {
      window.scrollTo(0, 0)
      this.pageviewTracker(location)
    }
  }

  handleSearchParamsUpdated(search) {
    const {dispatch} = this.props
    const {
      activate,
      utm_campaign: campaign,
      utm_content: content,
      utm_medium: medium,
      utm_source: source,
    } = parse(search)
    if (campaign || content || medium || source) {
      dispatch(trackInitialUtm({campaign, content, medium, source}))
    }
    if (activate) {
      dispatch(activateDemoInFuture(activate))
    }
  }

  removeAmpersandDoubleEncoding() {
    const {hash, pathname, search} = this.props.location
    const query = parse(search)
    if (!Object.keys(query).some(key => /^amp;/.test(key))) {
      return ''
    }
    return pathname + '?' + map(query, (value, key) =>
      encodeURIComponent(key.replace(/^amp;/, '')) + '=' +
      encodeURIComponent(value)).join('&') + hash
  }

  resolveInviteShortLink() {
    const {hash, pathname, search} = this.props.location
    if (pathname !== Routes.INVITE_PATH) {
      return ''
    }
    const params = 'utm_source=bob-emploi&utm_medium=link' +
      (hash ? `&utm_campaign=${hash.substr(1)}` : '')
    return Routes.ROOT + (search ? `${search}&${params}` : `?${params}`)
  }

  render() {
    const updatedPath = this.removeAmpersandDoubleEncoding()
    if (updatedPath) {
      return <Redirect to={updatedPath} />
    }
    const invitePath = this.resolveInviteShortLink()
    if (invitePath) {
      return <Redirect to={invitePath} />
    }
    return <StyleRoot>
      <div style={{backgroundColor: Colors.BACKGROUND_GREY}}>
        <Switch>
          <Route path={Routes.DASHBOARD_EXPORT} component={DashboardExportPage} />
          <Route path="/" component={UserCheckedPages} />
        </Switch>
        <Snackbar timeoutMillisecs={4000} />
      </div>
    </StyleRoot>
  }
}
const PageHolder = connect()(PageHolderBase)


class App extends React.Component {
  componentWillMount() {
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
        user: userReducer,
      })
    )
    if (module.hot) {
      module.hot.accept(['store/user_reducer', 'store/app_reducer'], () => {
        const nextAppReducerModule = require('store/app_reducer')
        store.replaceReducer(combineReducers({
          app: nextAppReducerModule.app,
          asyncState: nextAppReducerModule.asyncState,
          routing: routerReducer,
          user: require('store/user_reducer').userReducer,
        }))
      })
    }
    this.setState({history, store})
  }

  render() {
    const {history, store} = this.state
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

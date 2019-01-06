import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import createHistory from 'history/createBrowserHistory'
import Storage from 'local-storage-fallback'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import {StyleRoot} from 'radium'
import React from 'react'
import {connect, Provider} from 'react-redux'
import {Redirect, Route, Switch} from 'react-router-dom'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'
import {polyfill} from 'smoothscroll-polyfill'

import {actionTypesToLog, fetchUser, openLoginModal, switchToMobileVersionAction,
  migrateUserToAdvisor, trackInitialUtm, activateDemoInFuture, trackInitialFeatures,
  activateDemo, loginUserFromToken, pageIsLoaded, PAGE_IS_LOADED, isActionRegister,
  AUTHENTICATE_USER} from 'store/actions'
import {createAmplitudeMiddleware} from 'store/amplitude'
import {app, asyncState} from 'store/app_reducer'
import {createFacebookAnalyticsMiddleWare} from 'store/facebook_analytics'
import {createGoogleAnalyticsMiddleWare} from 'store/google_analytics'
import {onboardingComplete} from 'store/main_selectors'
import {userReducer} from 'store/user_reducer'

import {LoginModal} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {Snackbar} from 'components/snackbar'
import {Routes} from 'components/url'
import {WebpackChunksLoader} from 'components/webpack_chunks_loader'
import {SignUpPage} from './signup'
import {WaitingPage} from './waiting'

require('normalize.css')
require('styles/App.css')

polyfill()

// Timing between background loading of webpack chunks.
const WEBPACK_CHUNKS_LOADING_DELAY_MILLISECS = 3000
// Loads chunks one after the other, in the background.
const chunkLoader = new WebpackChunksLoader(WEBPACK_CHUNKS_LOADING_DELAY_MILLISECS, WaitingPage)

const LandingPage = chunkLoader.createLoadableComponent(
  () => import(/* webpackChunkName: 'landing' */'./landing.jsx'), 'landing', 3)
const QuickDiagnosticPage = chunkLoader.createLoadableComponent(
  () => import(/* webpackChunkName: 'landing' */'./quick_diagnostic.jsx').
    then(({QuickDiagnosticPage}) => QuickDiagnosticPage), 'landing', 3, true)


const staticPages = [
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/contribution.jsx'),
    route: Routes.CONTRIBUTION_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/cookies.jsx'),
    route: Routes.COOKIES_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/privacy.jsx'),
    route: Routes.PRIVACY_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/transparency.jsx'),
    route: Routes.TRANSPARENCY_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/team.jsx'),
    route: Routes.TEAM_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/professionals.jsx'),
    route: Routes.PROFESSIONALS_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/video_signup.jsx'),
    route: Routes.VIDEO_SIGNUP_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/terms.jsx'),
    route: Routes.TERMS_AND_CONDITIONS_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/vision.jsx'),
    route: Routes.VISION_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/imilo_integration.jsx'),
    route: Routes.IMILO_INTEGRATION_PAGE,
  },
  {
    loader: () => import(/* webpackChunkName: 'static' */'./static/static_advice.jsx'),
    route: Routes.STATIC_ADVICE_PATH,
  },
].map(({loader, route}) => ({
  Component: chunkLoader.createLoadableComponent(loader, 'static', 0),
  route,
}))


const LoadableProfilePage = chunkLoader.createLoadableComponent(
  () => import(/* webpackChunkName: 'connected' */'./connected/profile.jsx'), 'connected', 2)
const LoadableNewProjectPage = chunkLoader.createLoadableComponent(
  () => import(/* webpackChunkName: 'connected' */'./connected/new_project'), 'connected', 2)
const LoadableUpdatePage = chunkLoader.createLoadableComponent(
  () => import(/* webpackChunkName: 'connected' */'./connected/update.jsx'), 'connected', 2)
const LoadableProjectPage = chunkLoader.createLoadableComponent(
  () => import(/* webpackChunkName: 'connected' */'./connected/project.jsx'), 'connected', 2)


// Whitelist for the path of pages for which we allow storing the scroll position to jump
// there directly when coming back.
const PAGES_WITH_STORED_SCROLL = [Routes.PROJECT_PAGE]


// Pages that need to know whether a user is present or not. This component
// will try to login the user if there's a clue (in the cookies or in the URL),
// but not enforce it.
class UserCheckedPagesBase extends React.Component {
  static propTypes = {
    demo: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    hasLoginModal: PropTypes.bool,
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

  state = {
    isFetchingUser: false,
  }

  componentDidMount() {
    const {user, dispatch, location} = this.props
    const {authToken, email, resetToken, userId: userIdFromUrl} = parse(location.search)
    const userIdFromCookie = Storage.getItem('userId')

    // Reset password flow: disregard any page and just let the user reset
    // their password.
    if (resetToken) {
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

    dispatch(fetchUserAction).
      then(response => {
        if (!response) {
          dispatch(openLoginModal({
            email: email || '',
          }, 'returninguser'))
        }
        this.setState({isFetchingUser: false})
      })
  }

  componentDidUpdate(prevProps) {
    const {demo, dispatch, user: {userId}} = this.props
    if (!userId || userId === prevProps.user.userId) {
      return
    }
    if (demo) {
      dispatch(activateDemo(demo))
    }
    if (!this.isAdvisorUser(this.props.user)) {
      dispatch(migrateUserToAdvisor())
    }
  }

  isAdvisorUser(user) {
    const {advisor, switchedFromMashupToAdvisor} = user.featuresEnabled || {}
    return (!advisor || advisor === 'ACTIVE') &&
      (user.projects || []).length <= 1 ||
      switchedFromMashupToAdvisor
  }

  render() {
    const {hasLoginModal, hasUserSeenExplorer, location, user} = this.props
    const {isFetchingUser} = this.state
    const {hash, search} = location
    const hasUser = !!user.userId
    return <React.Fragment>
      <Switch>
        {/* Show signup page on mobile if no user is logged in and login modal should be opened.
            See http://go/bob:login-workflow for more information on the design. */}
        {isMobileVersion && hasLoginModal && !hasUser ? <Route path="*" component={SignUpPage} /> :
          null}
        {/* Pages that can be access both for logged-in and anonymous users. */}
        {staticPages.map(({Component, route}) => <Route
          path={route} key={`route-${route}`} component={Component} />)}

        {/* Special states. */}
        {isFetchingUser ? <Route path="*" component={WaitingPage} /> : null}

        {/* Landing page for anonymous users. */}
        {hasUser ? null : <Route path={Routes.JOB_SIGNUP_PAGE} component={LandingPage} />}
        {hasUser ? null :
          <Route path={Routes.QUICK_DIAGNOSTIC_PATH} component={QuickDiagnosticPage} />}
        {hasUser ? null : <Route path="*" component={LandingPage} />}

        {/* Pages for logged-in users that might not have completed their onboarding. */}
        <Route path={Routes.PROFILE_ONBOARDING_PAGES} component={LoadableProfilePage} />
        <Route path={Routes.NEW_PROJECT_ONBOARDING_PAGES} component={LoadableNewProjectPage} />
        <Route path={Routes.APP_UPDATED_PAGE} component={LoadableUpdatePage} />

        {/* Redirect if user is not fully ready. */}
        {this.isAdvisorUser(user) && hasUserSeenExplorer ? null :
          <Redirect to={Routes.APP_UPDATED_PAGE} />}
        {onboardingComplete(user) ? null : <Redirect to={Routes.PROFILE_PAGE} />}

        {/* Pages for logged-in user that have completed their onboarding. */}
        <Route path={Routes.PROJECT_PATH} component={LoadableProjectPage} />
        <Redirect to={Routes.PROJECT_PAGE + search + hash} />

      </Switch>
      {isMobileVersion || hasUser || !hasLoginModal ? null : <LoginModal />}
    </React.Fragment>
  }
}
const UserCheckedPages = connect(({app: {demo, lastAccessAt, loginModal}, user}) => ({
  demo,
  hasLoginModal: !!loginModal,
  hasUserSeenExplorer: !lastAccessAt || lastAccessAt > '2018-01-17',
  user,
}))(UserCheckedPagesBase)


// The main layout containing any page. Especially it handles the error message
// bar.
class PageHolderBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      pathname: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }),
    quickDiagnostic: PropTypes.string,
  }

  state = {}

  componentDidMount() {
    const {dispatch, location} = this.props
    this.handleSearchParamsUpdated(location.search || {})
    dispatch(pageIsLoaded(location))
    if (isMobileVersion) {
      dispatch(switchToMobileVersionAction)
      document.getElementById('viewport').setAttribute('content', 'initial-scale=1')
    }
  }

  getSnapshotBeforeUpdate({location: {pathname: prevPath}}) {
    const {location: {pathname = {}}} = this.props
    const isScrollStorable = PAGES_WITH_STORED_SCROLL.some(path => prevPath.startsWith(path))
    // Get scroll position before leaving.
    if (isScrollStorable && prevPath !== pathname) {
      const scrollHeight = window.scrollY || window.pageYOffset ||
        document.body.scrollTop + (document.documentElement.scrollTop || 0)
      return {[prevPath]: scrollHeight}
    }
    return null
  }

  componentDidUpdate({location: {pathname: prevPath, search: prevSearch}}, prevState, snapshot) {
    const {dispatch, location} = this.props
    const {pathname, search} = location
    if (snapshot) {
      this.setState(snapshot)
    }
    if (prevSearch !== search) {
      this.handleSearchParamsUpdated(search || {})
    }
    if (prevPath !== pathname) {
      window.scrollTo(0, this.state[pathname] || 0)
      dispatch(pageIsLoaded(location))
    }
  }

  handleSearchParamsUpdated(search) {
    const {dispatch, quickDiagnostic: previousQuickDiagnostic} = this.props
    const {
      activate,
      utm_campaign: campaign,
      utm_content: content,
      utm_medium: medium,
      utm_source: source,
    } = parse(search)
    if (!previousQuickDiagnostic) {
      const quickDiagnostic = (Math.random() < .1 && 'ACTIVE') || 'CONTROL'
      dispatch(trackInitialFeatures({quickDiagnostic}))
    }
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
    return pathname + '?' + Object.keys(query).map(key =>
      encodeURIComponent(key.replace(/^amp;/, '')) + '=' +
      encodeURIComponent(query[key])).join('&') + hash
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
      <div style={{backgroundColor: colors.BACKGROUND_GREY}}>
        <UserCheckedPages {...this.props} />
        <Snackbar timeoutMillisecs={4000} />
      </div>
    </StyleRoot>
  }
}
const PageHolder = connect(({app: {initialFeatures}}) =>
  ({quickDiagnostic: initialFeatures && initialFeatures.quickDiagnostic}))(PageHolderBase)


class App extends React.Component {
  static createHistoryAndStore() {
    const history = createHistory()

    const ravenMiddleware = RavenMiddleware(config.sentryDSN, {release: config.clientVersion}, {
      stateTransformer: function(state) {
        return {
          ...state,
          // Don't send user info to Sentry.
          user: 'Removed with ravenMiddleware stateTransformer',
        }
      },
    })
    const amplitudeMiddleware = createAmplitudeMiddleware(actionTypesToLog)
    const googleAnalyticsMiddleware = createGoogleAnalyticsMiddleWare(config.googleUAID, {
      [PAGE_IS_LOADED]: 'pageview',
    })
    const facebookAnalyticsMiddleware = createFacebookAnalyticsMiddleWare(config.facebookPixelID, {
      [AUTHENTICATE_USER]: {
        params: {'content_name': config.productName},
        predicate: isActionRegister,
        type: 'CompleteRegistration',
      },
    })
    // Enable devTools middleware.
    const finalCreateStore = composeWithDevTools(applyMiddleware(
      // ravenMiddleware needs to be first to correctly catch exception down the line.
      ravenMiddleware,
      thunk,
      amplitudeMiddleware,
      googleAnalyticsMiddleware,
      facebookAnalyticsMiddleware,
      routerMiddleware(history),
    ))(createStore)

    // Create the store that will be provided to connected components via Context.
    const store = finalCreateStore(
      combineReducers({
        app,
        asyncState,
        router: connectRouter(history),
        user: userReducer,
      })
    )
    if (module.hot) {
      module.hot.accept(['store/user_reducer', 'store/app_reducer'], () => {
        const nextAppReducerModule = require('store/app_reducer')
        store.replaceReducer(combineReducers({
          app: nextAppReducerModule.app,
          asyncState: nextAppReducerModule.asyncState,
          router: connectRouter(history),
          user: require('store/user_reducer').userReducer,
        }))
      })
    }
    return {history, store}
  }

  state = App.createHistoryAndStore()

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

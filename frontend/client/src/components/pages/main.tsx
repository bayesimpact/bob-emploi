import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import i18n from 'i18next'
import {History, createBrowserHistory} from 'history'
import {parse} from 'query-string'
import React, {Suspense} from 'react'
import {connect, Provider} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'
import {Store, createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'
import {polyfill} from 'smoothscroll-polyfill'

import {actionTypesToLog, fetchUser, switchToMobileVersionAction, migrateUserToAdvisor,
  trackInitialUtm, activateDemoInFuture, activateDemo, pageIsLoaded, isActionRegister, RootState,
  DispatchAllActions, AllActions, hideToasterMessageAction} from 'store/actions'
import {createAmplitudeMiddleware} from 'store/amplitude'
import {app, asyncState} from 'store/app_reducer'
import {createFacebookAnalyticsMiddleWare} from 'store/facebook_analytics'
import {createGoogleAnalyticsMiddleWare} from 'store/google_analytics'
import {init as i18nInit} from 'store/i18n'
import {Logger} from 'store/logging'
import {onboardingComplete} from 'store/main_selectors'
import {parsedValueFlattener, removeAmpersandDoubleEncoding} from 'store/parse'
import {createSentryMiddleware} from 'store/sentry'
import {userReducer} from 'store/user_reducer'
import {getUserLocale, isAdvisorUser} from 'store/user'

import {LoginModal} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {Snackbar} from 'components/snackbar'
import {Routes, SIGNUP_HASH, staticPages} from 'components/url'
import {IntroPage} from './intro'
import {SignUpPage} from './signup'
import {WaitingPage} from './waiting'

require('normalize.css')
require('styles/App.css')

polyfill()

const LandingPage = React.lazy((): Promise<typeof import('./landing')> =>
  import(/* webpackChunkName: 'landing', webpackPrefetch: 3 */'./landing'))

const StaticPages = React.lazy((): Promise<typeof import('./static')> =>
  import(/* webpackChunkName: 'static', webpackPrefetch: 0 */'./static'))

const LoadableProfilePage = React.lazy((): Promise<typeof import('./connected/profile')> =>
  import(/* webpackChunkName: 'connected', webpackPrefetch: 2 */'./connected/profile'))
const LoadableNewProjectPage = React.lazy((): Promise<typeof import('./connected/new_project')> =>
  import(/* webpackChunkName: 'connected', webpackPrefetch: 2 */'./connected/new_project'))
const LoadableProjectPage = React.lazy((): Promise<typeof import('./connected/project')> =>
  import(/* webpackChunkName: 'connected', webpackPrefetch: 2 */'./connected/project'))


i18nInit()


// Whitelist for the path of pages for which we allow storing the scroll position to jump
// there directly when coming back.
const PAGES_WITH_STORED_SCROLL = [Routes.PROJECT_PAGE]


interface UserCheckedPagesConnectedProps {
  demo?: keyof bayes.bob.Features
  hasLoginModal: boolean
  isFetchingUser: boolean
  user: bayes.bob.User
}

interface UserCheckedPagesProps extends UserCheckedPagesConnectedProps {
  dispatch: DispatchAllActions
  location: {
    hash: string
    pathname: string
    search: string
  }
}

// Pages that need to know whether a user is present or not. This component
// will try to login the user if there's a clue (in the cookies or in the URL),
// but not enforce it.
class UserCheckedPagesBase extends
  React.Component<UserCheckedPagesProps> {

  public componentDidMount(): void {
    const {user: {userId}, dispatch} = this.props

    if (userId) {
      dispatch(fetchUser(userId, true))
    }
  }

  public componentDidUpdate(prevProps: UserCheckedPagesProps): void {
    const {demo, dispatch, user, user: {featuresEnabled, profile, userId}} = this.props
    if (!userId || user === prevProps.user) {
      return
    }
    if (demo && (!featuresEnabled || featuresEnabled[demo] !== 'ACTIVE')) {
      dispatch(activateDemo(demo))
    }
    if (!isAdvisorUser(user)) {
      dispatch(migrateUserToAdvisor())
    }
    const newLocale = getUserLocale(profile)
    if (newLocale !== i18n.language) {
      i18n.changeLanguage(newLocale)
    }
  }

  public render(): React.ReactNode {
    const {hasLoginModal, isFetchingUser, location, user} = this.props
    const {hash, search} = location
    const {authToken, resetToken, state, userId} = parse(search)
    const hasUser = !!user.registeredAt
    const hasRegisteredUser = hasUser && user.hasAccount
    const hasUrlLoginIncentive =
      resetToken ||
      !hasRegisteredUser && state ||
      !hasUser && (hash === SIGNUP_HASH || (authToken && userId))
    return <React.Fragment>
      <Suspense fallback={<WaitingPage />}>
        <Switch>
          {hasUrlLoginIncentive ? <Route path="*" component={SignUpPage} /> : null}

          {/* Pages that can be access both for logged-in and anonymous users. */}
          {staticPages.map((path: string): React.ReactElement =>
            <Route path={path} key={path} component={StaticPages} />)}

          {/* User is being fetched. */}
          {isFetchingUser ? <Route path="*" component={WaitingPage} /> : null}

          {/* Landing page for anonymous users. */}
          {hasUser ? null : <Route path={Routes.JOB_SIGNUP_PAGE} component={LandingPage} />}
          {hasUser ? null : <Route path={Routes.ROOT} exact={true} component={LandingPage} />}

          {/* Intro page for anonymous users.*/}
          {hasUser ? null : <Route path={Routes.INTRO_PAGE} component={IntroPage} />}

          {/* Signup and login routes. */}
          {/* We're on a connected page, without a user, so we show the login modal. */}
          {hasUser ? null : <Route path="*" component={SignUpPage} />}
          {isMobileVersion && !hasRegisteredUser ?
            <Route path={Routes.SIGNUP_PAGE} component={SignUpPage} /> : null}

          {/* Pages for logged-in users that might not have completed their onboarding. */}
          <Route path={Routes.PROFILE_ONBOARDING_PAGES} component={LoadableProfilePage} />
          <Route path={Routes.NEW_PROJECT_ONBOARDING_PAGES} component={LoadableNewProjectPage} />

          {onboardingComplete(user) ? null : <Redirect to={Routes.PROFILE_PAGE} />}

          {/* Pages for logged-in user that have completed their onboarding. */}
          <Route path={Routes.PROJECT_PATH} component={LoadableProjectPage} />
          <Route path={Routes.PROJECT_PAGE} component={LoadableProjectPage} />
          <Redirect to={Routes.PROJECT_PAGE + search + hash} />

        </Switch>
        {hasLoginModal && !isMobileVersion && (hasUrlLoginIncentive || !hasRegisteredUser) ?
          <LoginModal /> : null}
      </Suspense>
    </React.Fragment>
  }
}
const UserCheckedPages = connect(
  ({
    app: {demo, loginModal},
    asyncState: {isFetching},
    user,
  }: RootState): UserCheckedPagesConnectedProps => ({
    demo,
    hasLoginModal: !!loginModal,
    isFetchingUser: !!isFetching['GET_USER_DATA'],
    user,
  }))(UserCheckedPagesBase)


interface PageHolderProps extends RouteComponentProps<{}> {
  dispatch: DispatchAllActions
}


interface PageHolderState {
  [pathname: string]: number
}


const MainSnackbar = connect(
  ({asyncState}: RootState): {snack?: string} => ({
    snack: asyncState.errorMessage,
  }),
  (dispatch: DispatchAllActions) => ({
    onHide: (): void => void dispatch(hideToasterMessageAction),
  }),
)(Snackbar)


// The main layout containing any page. Especially it handles the error message
// bar.
class PageHolderBase extends React.Component<PageHolderProps, PageHolderState> {
  public state: PageHolderState = {}

  public componentDidMount(): void {
    const {dispatch, location} = this.props
    this.handleSearchParamsUpdated(location.search)
    dispatch(pageIsLoaded(location))
    if (isMobileVersion) {
      dispatch(switchToMobileVersionAction)
      const viewport = document.getElementById('viewport')
      viewport && viewport.setAttribute('content', 'initial-scale=1')
    }
  }

  public getSnapshotBeforeUpdate(
    {location: {pathname: prevPath}}: PageHolderProps): PageHolderState|null {
    const {location: {pathname = {}}} = this.props
    const isScrollStorable = PAGES_WITH_STORED_SCROLL.
      some((path: string): boolean => prevPath.startsWith(path))
    // Get scroll position before leaving.
    if (isScrollStorable && prevPath !== pathname) {
      const scrollHeight = window.scrollY || window.pageYOffset ||
        document.body.scrollTop + (document.documentElement.scrollTop || 0)
      return {[prevPath]: scrollHeight}
    }
    return null
  }

  public componentDidUpdate(
    {location: {pathname: prevPath, search: prevSearch}}: PageHolderProps,
    prevState: PageHolderState, snapshot: PageHolderState|null): void {
    const {dispatch, location} = this.props
    const {pathname, search} = location
    if (snapshot) {
      this.setState(snapshot)
    }
    if (prevSearch !== search) {
      this.handleSearchParamsUpdated(search)
    }
    if (prevPath !== pathname) {
      window.scrollTo(0, this.state[pathname] || 0)
      dispatch(pageIsLoaded(location))
    }
  }

  private handleSearchParamsUpdated(search: string): void {
    const {dispatch} = this.props
    const {
      activate,
      utm_campaign: campaign,
      utm_content: content,
      utm_medium: medium,
      utm_source: source,
    } = parse(search)
    if (campaign || content || medium || source) {
      dispatch(trackInitialUtm({
        campaign: parsedValueFlattener.last(campaign),
        content: parsedValueFlattener.last(content),
        medium: parsedValueFlattener.last(medium),
        source: parsedValueFlattener.last(source),
      }))
    }
    if (activate) {
      if (typeof activate === 'object') {
        activate.forEach((demo: string): void => {
          dispatch(activateDemoInFuture(demo as keyof bayes.bob.Features))
        })
      } else {
        dispatch(activateDemoInFuture(activate as keyof bayes.bob.Features))
      }
    }
  }

  private resolveInviteShortLink(): string {
    const {hash, pathname, search} = this.props.location
    if (pathname !== Routes.INVITE_PATH) {
      return ''
    }
    const params = 'utm_source=bob-emploi&utm_medium=link' +
      (hash ? `&utm_campaign=${hash.slice(1)}` : '')
    return Routes.ROOT + (search ? `${search}&${params}` : `?${params}`)
  }

  public render(): React.ReactNode {
    const updatedPath = removeAmpersandDoubleEncoding(this.props.location)
    if (updatedPath) {
      return <Redirect to={updatedPath} />
    }
    const invitePath = this.resolveInviteShortLink()
    if (invitePath) {
      return <Redirect to={invitePath} />
    }
    return <div style={{backgroundColor: colors.BACKGROUND_GREY, color: colors.DARK_TWO}}>
      <UserCheckedPages {...this.props} />
      <MainSnackbar timeoutMillisecs={4000} />
    </div>
  }
}
const PageHolder = connect()(PageHolderBase)

interface AppState {
  history: History
  store: Store<RootState, AllActions>
}

class App extends React.Component<{}, AppState> {
  private static createHistoryAndStore(): AppState {
    const history = createBrowserHistory()

    const sentryMiddleware = createSentryMiddleware()
    const amplitudeMiddleware = createAmplitudeMiddleware(new Logger(actionTypesToLog))
    const googleAnalyticsMiddleware = createGoogleAnalyticsMiddleWare(config.googleUAID, {
      PAGE_IS_LOADED: 'pageview',
    })
    const facebookAnalyticsMiddleware = createFacebookAnalyticsMiddleWare(config.facebookPixelID, {
      AUTHENTICATE_USER: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        params: {content_name: config.productName},
        predicate: isActionRegister,
        type: 'CompleteRegistration',
      },
    })
    // Enable devTools middleware.
    const finalCreateStore = composeWithDevTools(applyMiddleware(
      // sentryMiddleware needs to be first to correctly catch exception down the line.
      sentryMiddleware,
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
      }),
    )
    if (module.hot) {
      module.hot.accept(['store/user_reducer', 'store/app_reducer'], (): void => {
        const nextAppReducerModule = require('store/app_reducer')
        const nextUserReducerModule = require('store/user_reducer')
        store.replaceReducer(combineReducers({
          app: nextAppReducerModule.app as typeof app,
          asyncState: nextAppReducerModule.asyncState as typeof asyncState,
          router: connectRouter(history),
          user: nextUserReducerModule.userReducer as typeof userReducer,
        }))
      })
    }
    return {history, store}
  }

  public readonly state = App.createHistoryAndStore()

  public render(): React.ReactNode {
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

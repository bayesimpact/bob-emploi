import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {History, createBrowserHistory} from 'history'
import {parse} from 'query-string'
import Radium from 'radium'
import React from 'react'
import {LoadingComponentProps} from 'react-loadable'
import {connect, Provider} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'
import {Store, createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'
import {polyfill} from 'smoothscroll-polyfill'

import {actionTypesToLog, fetchUser, switchToMobileVersionAction, migrateUserToAdvisor,
  trackInitialUtm, activateDemoInFuture, activateDemo, pageIsLoaded, isActionRegister, RootState,
  DispatchAllActions, AllActions} from 'store/actions'
import {createAmplitudeMiddleware} from 'store/amplitude'
import {app, asyncState} from 'store/app_reducer'
import {createFacebookAnalyticsMiddleWare} from 'store/facebook_analytics'
import {createGoogleAnalyticsMiddleWare} from 'store/google_analytics'
import {onboardingComplete} from 'store/main_selectors'
import {userReducer} from 'store/user_reducer'

import {LoginModal} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {Snackbar} from 'components/snackbar'
import {Routes, SIGNUP_HASH} from 'components/url'
import {WebpackChunksLoader} from 'components/webpack_chunks_loader'
import {IntroPage} from './intro'
import {SignUpPage} from './signup'
import {WaitingPage} from './waiting'

require('normalize.css')
require('styles/App.css')

polyfill()

// Timing between background loading of webpack chunks.
const WEBPACK_CHUNKS_LOADING_DELAY_MILLISECS = 3000
// Loads chunks one after the other, in the background.
const chunkLoader = new WebpackChunksLoader(
  WEBPACK_CHUNKS_LOADING_DELAY_MILLISECS, WaitingPage as React.ComponentType<LoadingComponentProps>)

const LandingPage = chunkLoader.createLoadableComponent(
  (): Promise<typeof import('./landing')> =>
  import(/* webpackChunkName: 'landing' */'./landing'), 'landing', 3)


interface StaticPage<PropsType = {}> {
  Component: React.ComponentType<PropsType>
  route: string
}


interface StaticPageLoader<PropsType> {
  loader: () => Promise<React.ComponentType<PropsType>|{default: React.ComponentType<PropsType>}>
  route: string
}


function preparePage<P>({loader, route}: StaticPageLoader<P>): StaticPage<P> {
  return {
    Component: chunkLoader.createLoadableComponent(loader, 'static', 0),
    route,
  }
}


const staticPages:
readonly (StaticPage | StaticPage<RouteComponentProps<{adviceId?: string}>>)[] = [
  {
    loader: (): Promise<typeof import('./static/contribution')> =>
      import(/* webpackChunkName: 'static' */'./static/contribution'),
    route: Routes.CONTRIBUTION_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/cookies')> =>
      import(/* webpackChunkName: 'static' */'./static/cookies'),
    route: Routes.COOKIES_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/privacy')> =>
      import(/* webpackChunkName: 'static' */'./static/privacy'),
    route: Routes.PRIVACY_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/transparency')> =>
      import(/* webpackChunkName: 'static' */'./static/transparency'),
    route: Routes.TRANSPARENCY_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/team')> =>
      import(/* webpackChunkName: 'static' */'./static/team'),
    route: Routes.TEAM_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/professionals')> =>
      import(/* webpackChunkName: 'static' */'./static/professionals'),
    route: Routes.PROFESSIONALS_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/video_signup')> =>
      import(/* webpackChunkName: 'static' */'./static/video_signup'),
    route: Routes.VIDEO_SIGNUP_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/terms')> =>
      import(/* webpackChunkName: 'static' */'./static/terms'),
    route: Routes.TERMS_AND_CONDITIONS_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/vision')> =>
      import(/* webpackChunkName: 'static' */'./static/vision'),
    route: Routes.VISION_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/imilo_integration')> =>
      import(/* webpackChunkName: 'static' */'./static/imilo_integration'),
    route: Routes.IMILO_INTEGRATION_PAGE,
  },
  {
    loader: (): Promise<typeof import('./static/static_advice')> =>
      import(/* webpackChunkName: 'static' */'./static/static_advice'),
    route: Routes.STATIC_ADVICE_PATH,
  },
].map(preparePage)


const LoadableProfilePage = chunkLoader.createLoadableComponent(
  (): Promise<typeof import('./connected/profile')> =>
    import(/* webpackChunkName: 'connected' */'./connected/profile'),
  'connected', 2)
const LoadableNewProjectPage = chunkLoader.createLoadableComponent(
  (): Promise<typeof import('./connected/new_project')> =>
    import(/* webpackChunkName: 'connected' */'./connected/new_project'),
  'connected', 2)
const LoadableUpdatePage = chunkLoader.createLoadableComponent(
  (): Promise<typeof import('./connected/update')> =>
    import(/* webpackChunkName: 'connected' */'./connected/update'),
  'connected', 2)
const LoadableProjectPage = chunkLoader.createLoadableComponent(
  (): Promise<typeof import('./connected/project')> =>
    import(/* webpackChunkName: 'connected' */'./connected/project'),
  'connected', 2)


// Whitelist for the path of pages for which we allow storing the scroll position to jump
// there directly when coming back.
const PAGES_WITH_STORED_SCROLL = [Routes.PROJECT_PAGE]


interface UserCheckedPagesConnectedProps {
  demo?: string
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

  // TODO(cyrille): Make it static.
  private isAdvisorUser(user): boolean {
    const {advisor = undefined, switchedFromMashupToAdvisor = false} = user.featuresEnabled || {}
    return (!advisor || advisor === 'ACTIVE') &&
      (user.projects || []).length <= 1 ||
      switchedFromMashupToAdvisor
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
      <Switch>
        {hasUrlLoginIncentive ? <Route path="*" component={SignUpPage} /> : null}
        {/* Pages that can be access both for logged-in and anonymous users. */}
        {staticPages.map(({Component, route}): React.ReactNode => <Route
          path={route} key={`route-${route}`} component={Component} />)}

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
        {/* TODO(cyrille): Drop this page. */}
        <Route path={Routes.APP_UPDATED_PAGE} component={LoadableUpdatePage} />

        {onboardingComplete(user) ? null : <Redirect to={Routes.PROFILE_PAGE} />}

        {/* Pages for logged-in user that have completed their onboarding. */}
        <Route path={Routes.PROJECT_PATH} component={LoadableProjectPage} />
        <Route path={Routes.PROJECT_PAGE} component={LoadableProjectPage} />
        <Redirect to={Routes.PROJECT_PAGE + search + hash} />

      </Switch>
      {hasLoginModal && !isMobileVersion && (hasUrlLoginIncentive || !hasRegisteredUser) ?
        <LoginModal /> : null}
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


interface PageHolderProps {
  dispatch: DispatchAllActions
  location: {
    hash: string
    pathname: string
    search: string
  }
}


interface PageHolderState {
  [pathname: string]: number
}


// The main layout containing any page. Especially it handles the error message
// bar.
class PageHolderBase extends React.Component<PageHolderProps, PageHolderState> {
  public state = {}

  public componentDidMount(): void {
    const {dispatch, location} = this.props
    this.handleSearchParamsUpdated(location.search || {})
    dispatch(pageIsLoaded(location))
    if (isMobileVersion) {
      dispatch(switchToMobileVersionAction)
      const viewport = document.getElementById('viewport')
      viewport && viewport.setAttribute('content', 'initial-scale=1')
    }
  }

  public getSnapshotBeforeUpdate({location: {pathname: prevPath}}): PageHolderState|null {
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
    {location: {pathname: prevPath, search: prevSearch}}, prevState, snapshot): void {
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

  private handleSearchParamsUpdated(search): void {
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

  private removeAmpersandDoubleEncoding(): string {
    const {hash, pathname, search} = this.props.location
    const query = parse(search)
    if (!Object.keys(query).some((key: string): boolean => key.startsWith('amp;'))) {
      return ''
    }
    return pathname + '?' + Object.keys(query).map((key: string): string =>
      encodeURIComponent(key.replace(/^amp;/, '')) + '=' +
      encodeURIComponent(query[key])).join('&') + hash
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
    const updatedPath = this.removeAmpersandDoubleEncoding()
    if (updatedPath) {
      return <Redirect to={updatedPath} />
    }
    const invitePath = this.resolveInviteShortLink()
    if (invitePath) {
      return <Redirect to={invitePath} />
    }
    return <Radium.StyleRoot>
      <div style={{backgroundColor: colors.BACKGROUND_GREY, color: colors.DARK_TWO}}>
        <UserCheckedPages {...this.props} />
        <Snackbar timeoutMillisecs={4000} />
      </div>
    </Radium.StyleRoot>
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

    const ravenMiddleware = RavenMiddleware(
      config.sentryDSN, {
        release: config.clientVersion,
      }, {
        stateTransformer: function(state: AppState): {} {
          return {
            ...state,
            // Don't send user info to Sentry.
            user: 'Removed with ravenMiddleware stateTransformer',
          }
        },
      })
    const amplitudeMiddleware = createAmplitudeMiddleware(actionTypesToLog)
    const googleAnalyticsMiddleware = createGoogleAnalyticsMiddleWare(config.googleUAID, {
      PAGE_IS_LOADED: 'pageview',
    })
    const facebookAnalyticsMiddleware = createFacebookAnalyticsMiddleWare(config.facebookPixelID, {
      AUTHENTICATE_USER: {
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

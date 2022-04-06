import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import i18n from 'i18next'
import type {History} from 'history'
import {createBrowserHistory} from 'history'
import {parse} from 'query-string'
import React, {Suspense, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {connect, Provider, useDispatch, useSelector} from 'react-redux'
import {useLocation} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'
import type {Store} from 'redux'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'
import {polyfill} from 'smoothscroll-polyfill'

import 'normalize.css'
import 'styles/App.css'

import TabNavigationProvider from 'hooks/tab_navigation'
import type {AllActions, RootState, DispatchAllActions} from 'store/actions'
import {actionTypesToLog, fetchUser, migrateUserToAdvisor, hideToasterMessageAction,
  trackInitialUtm, activateExperimentInFuture, activateExperiments, pageIsLoaded, isActionRegister,
  removeAuthDataAction, askForAdsCookieUsageAction} from 'store/actions'
import createAmplitudeMiddleware from 'store/amplitude'
import {app, asyncState} from 'store/app_reducer'
import createFacebookAnalyticsMiddleWare from 'store/facebook_analytics'
import createGoogleAnalyticsMiddleWare from 'store/google_analytics'
import createGoogleTagManagerMiddleWare from 'store/google_tag_manager'
import {init as i18nInit} from 'store/i18n'
import {Logger} from 'store/logging'
import {onboardingComplete} from 'store/main_selectors'
import {parseQueryString, removeAmpersandDoubleEncoding} from 'store/parse'
import {useAsynceffect} from 'store/promise'
import createSentryEnhancer from 'store/sentry'
import userReducer from 'store/user_reducer'
import {getUserLocale, isAdvisorUser} from 'store/user'
import {initialUtm} from 'store/utm'

import {LoginModal} from 'components/login'
import isMobileVersion from 'store/mobile'
import Snackbar from 'components/snackbar'
import {Routes, SIGNUP_HASH, staticPages} from 'components/url'
import {IntroPage} from './intro'
import {SignUpPage} from './signup'
import WaitingPage from './waiting'

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


// Do not set custom options here.
i18nInit()


// Set of path of pages for which we allow storing the scroll position to jump
// there directly when coming back.
const PAGES_WITH_STORED_SCROLL = [Routes.PROJECT_PAGE]


// Pages that need to know whether a user is present or not. This component
// will try to login the user if there's a clue (in the cookies or in the URL),
// but not enforce it.
const UserCheckedPagesBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const user = useSelector(({user}: RootState): bayes.bob.User => user)
  const experiments = useSelector(({app: {experiments}}: RootState) => experiments)
  const hasLoginModal = useSelector(({app: {loginModal}}: RootState): boolean => !!loginModal)
  const isFetchingUser = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean => !!isFetching['GET_USER_DATA'],
  )
  const {hash, search} = useLocation()

  const {featuresEnabled, hasAccount, profile, userId, registeredAt} = user
  const hasUser = !!registeredAt

  useAsynceffect(async (checkIfCanceled) => {
    if (!userId || hasUser || await dispatch(fetchUser(userId, true)) || checkIfCanceled()) {
      return
    }
    dispatch(removeAuthDataAction)
  }, [dispatch, hasUser, userId])

  useEffect((): void => {
    if (!hasUser) {
      return
    }
    if (experiments?.length) {
      dispatch(activateExperiments(experiments))
    }
  }, [experiments, dispatch, featuresEnabled, hasUser])

  useEffect((): void => {
    if (!isAdvisorUser(user)) {
      dispatch(migrateUserToAdvisor())
    }
  }, [dispatch, user])

  const newLocale = profile ? getUserLocale(profile) : i18n.language
  useEffect((): void => {
    if (newLocale !== i18n.language) {
      i18n.changeLanguage(newLocale)
    }
  }, [newLocale])

  const {authToken, resetToken, state, userId: locationUserId} = parseQueryString(search)
  const hasRegisteredUser = hasUser && hasAccount
  const hasUrlLoginIncentive =
    resetToken ||
    !hasRegisteredUser && state ||
    !hasUser && (hash === SIGNUP_HASH || (authToken && locationUserId))
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

        {onboardingComplete(user) ? null : <Route><Redirect to={Routes.PROFILE_PAGE} /></Route>}

        {/* Pages for logged-in user that have completed their onboarding. */}
        <Route path={Routes.PROJECT_PATH} component={LoadableProjectPage} />
        <Route path={Routes.PROJECT_PAGE} component={LoadableProjectPage} />
        <Route><Redirect to={Routes.PROJECT_PAGE + search + hash} /></Route>

      </Switch>
      {hasLoginModal && !isMobileVersion && (hasUrlLoginIncentive || !hasRegisteredUser) ?
        <LoginModal /> : null}
    </Suspense>
  </React.Fragment>
}
const UserCheckedPages = React.memo(UserCheckedPagesBase)


interface ScrollPerPage {
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


// The main layout containing any page. Especially it handles the error message bar.
const PageHolderBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const location = useLocation()
  const {hash, pathname, search} = location

  useEffect((): void => {
    const {
      utm_campaign: campaign,
      utm_content: content,
      utm_medium: medium,
      utm_source: source,
    } = parseQueryString(search)
    const {activate} = parse(search)
    if (campaign || content || medium || source) {
      dispatch(trackInitialUtm({campaign, content, medium, source}))
    }
    if (activate) {
      if (typeof activate === 'object') {
        for (const experiment of activate) {
          dispatch(activateExperimentInFuture(experiment as keyof bayes.bob.Features))
        }
      } else {
        dispatch(activateExperimentInFuture(activate as keyof bayes.bob.Features))
      }
    }
  }, [dispatch, search])

  const scrollPerPage = useRef<ScrollPerPage>({})
  const lastPathName = useRef(pathname)
  useLayoutEffect((): void => {
    const prevPath = lastPathName.current
    const isScrollStorable = PAGES_WITH_STORED_SCROLL.
      some((path: string): boolean => prevPath.startsWith(path))
    lastPathName.current = pathname
    // Get scroll position before leaving.
    if (isScrollStorable && prevPath !== pathname) {
      const scrollHeight = window.scrollY || window.pageYOffset ||
        document.body.scrollTop + (document.documentElement.scrollTop || 0)
      scrollPerPage.current[prevPath] = scrollHeight
    }
  })
  useEffect((): void => {
    window.scrollTo(0, scrollPerPage.current[pathname] || 0)
    dispatch(pageIsLoaded(location))
    // This effect should only run when the pathname is updated, and when it's updated then we
    // know we get a fresh location object as well.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, pathname])

  const updatedPath = removeAmpersandDoubleEncoding(location)
  if (updatedPath) {
    return <Redirect to={updatedPath} />
  }

  if (pathname === Routes.INVITE_PATH) {
    const params = 'utm_source=bob-emploi&utm_medium=link' +
      (hash ? `&utm_campaign=${hash.slice(1)}` : '')
    return <Redirect to={Routes.ROOT + (search ? `${search}&${params}` : `?${params}`)} />
  }

  return <div style={{backgroundColor: colors.BACKGROUND_GREY, color: colors.DARK_TWO}}>
    <UserCheckedPages />
    <MainSnackbar timeoutMillisecs={4000} />
  </div>
}
const PageHolder = React.memo(PageHolderBase)


interface AppState {
  history: History
  store: Store<RootState, AllActions>
}


function createHistoryAndStore(): AppState {
  const history = createBrowserHistory()

  const {medium: utmMedium, source: utmSource} = initialUtm || {}
  const isUserComingFromGoogleAds = utmSource === 'googleads'
  const isUserComingFromFacebookAds = utmSource === 'facebook' && utmMedium === 'ad'

  const sentryEnhancer = createSentryEnhancer()
  const amplitudeMiddleware = createAmplitudeMiddleware(new Logger(actionTypesToLog))
  const googleAnalyticsMiddleware = isUserComingFromGoogleAds ? [createGoogleAnalyticsMiddleWare(
    config.googleUAID, {PAGE_IS_LOADED: 'pageview'})] : []
  const googleTagManagerMiddleware = isUserComingFromGoogleAds ?
    [createGoogleTagManagerMiddleWare()] : []
  const facebookAnalyticsMiddleware = isUserComingFromFacebookAds ?
    [createFacebookAnalyticsMiddleWare(config.facebookPixelID, {
      AUTHENTICATE_USER: {
        // eslint-disable-next-line camelcase
        params: {content_name: config.productName},
        predicate: isActionRegister,
        type: 'CompleteRegistration',
      },
    })] : []
  // Enable devTools middleware.
  const finalCreateStore = composeWithDevTools(applyMiddleware(
    thunk,
    amplitudeMiddleware,
    ...googleAnalyticsMiddleware,
    ...googleTagManagerMiddleware,
    ...facebookAnalyticsMiddleware,
    routerMiddleware(history),
  ), sentryEnhancer)(createStore)

  // Create the store that will be provided to connected components via Context.
  const store = finalCreateStore(
    combineReducers({
      app,
      asyncState,
      router: connectRouter(history),
      user: userReducer,
    }),
  )
  if (isUserComingFromGoogleAds || isUserComingFromFacebookAds) {
    store.dispatch(askForAdsCookieUsageAction)
  }
  // eslint-disable-next-line unicorn/prefer-module
  if (module.hot) {
    // eslint-disable-next-line unicorn/prefer-module
    module.hot.accept(['store/user_reducer', 'store/app_reducer'], async (): Promise<void> => {
      const nextAppReducerModule = await import('store/app_reducer')
      const nextUserReducerModule = await import('store/user_reducer')
      store.replaceReducer(combineReducers({
        app: nextAppReducerModule.app,
        asyncState: nextAppReducerModule.asyncState,
        router: connectRouter(history),
        user: nextUserReducerModule.default,
      }))
    })
  }
  return {history, store}
}

const App = (): React.ReactElement => {
  const [{history, store}] = useState(createHistoryAndStore)
  // The Provider puts the store on a `Context`, so we can connect other
  // components to it.
  return <Provider store={store}>
    <TabNavigationProvider>
      <ConnectedRouter history={history}>
        <Route path="/" component={PageHolder} />
      </ConnectedRouter>
    </TabNavigationProvider>
  </Provider>
}


export default React.memo(App)

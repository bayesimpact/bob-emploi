import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {createBrowserHistory} from 'history'
import React, {Suspense, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Provider, connect, useDispatch, useSelector} from 'react-redux'
import {useLocation, Redirect, Route, Switch} from 'react-router'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'

import 'styles/App.css'

import TabNavigationProvider from 'hooks/tab_navigation'
import useTrackUtms from 'hooks/track_utms'
import type {RootState} from 'store/actions'
import {hideToasterMessageAction, pageIsLoaded} from 'store/actions'
import createAmplitudeMiddleware from 'store/amplitude'
import {asyncState} from 'store/app_reducer'
import {init as i18nInit} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {parseQueryString} from 'store/parse'
import createSentryEnhancer from 'store/sentry'

import DebugModal from 'components/debug_modal'
import Snackbar from 'components/snackbar'
import SkipToContent from 'components/skip_to_content'
import {Routes} from 'components/url'

import CoachingModal from 'plugin/deployment/coaching_modal'
import NetflixBanner from 'plugin/deployment/netflix_banner'

// TODO(émilie): Load the fonts only when needed.
import '../../styles/fonts/Barlow/font.css'
import '../../styles/fonts/Poppins/font.css'
import '../../styles/fonts/Miso/font.css'

import useCoaching from '../../hooks/features'
import type {DispatchAllUpskillingActions} from '../../store/actions'
import {actionTypesToLog, setLocalUser, setLocalUserLocale} from '../../store/actions'
import app from '../../store/app_reducer'
import createGoogleAnalyticsMiddleWare from '../../store/google_analytics_new'
import UpskillingLogger from '../../store/logging'
import user from '../../store/user_reducer'

import JobEvaluationModal from '../job_evaluation'
import TopBar from '../top_bar'
import {JobDetailModal} from '../job_detail'
import CookiesPage from './cookies_page'
import JobDetailPage from './job_detail'
import NetflixPage from './netflix'
import {horizontalPagePadding, verticalPagePadding} from '../padding'
import SectionPage from './section'
import TermsPage from './terms'
import WaitingPage from './waiting'
import WelcomePage from './welcome'

import '../../styles/App.css'

i18nInit({defaultNS: 'upskilling'})

const createAppState = () => {
  const history = createBrowserHistory(
    window.location.hostname.includes(config.prodDistinctiveFragment) ? {} :
      {basename: 'orientation'})

  const amplitudeMiddleware = createAmplitudeMiddleware(new UpskillingLogger(actionTypesToLog))

  const {utm_source: utmSource} = parseQueryString(window.location.search)
  const isUserComingFromGoogleAds = utmSource === 'googleads'

  // Enable Google Analytics only for user coming from Google Ads.
  const googleAnalyticsMiddleWare = isUserComingFromGoogleAds ?
    [createGoogleAnalyticsMiddleWare(config.googleUAID, {
      UPSKILLING_EXPLORE_JOB: ['explore', ['sectionId', 'jobName']],
    })] : []

  // Enable devTools middleware.
  const finalCreateStore = composeWithDevTools(
    // sentryMiddleware needs to be first to correctly catch exception down the line.
    applyMiddleware(
      thunk,
      amplitudeMiddleware,
      ...googleAnalyticsMiddleWare,
      routerMiddleware(history),
    ),
    createSentryEnhancer(),
  )(createStore)

  // Create the store that will be provided to connected components via Context.
  const store = finalCreateStore(
    combineReducers({
      app,
      asyncState,
      router: connectRouter(history),
      user,
    }),
  )
  // eslint-disable-next-line unicorn/prefer-module
  if (module.hot) {
    // eslint-disable-next-line unicorn/prefer-module
    module.hot.accept(['../../store/app_reducer', '../../store/user_reducer'], async () => {
      const {default: newApp} = await import('../../store/app_reducer')
      const {default: newUser} = await import('../../store/user_reducer')
      store.replaceReducer(combineReducers({
        app: newApp,
        asyncState,
        router: connectRouter(history),
        user: newUser,
      }))
    })
  }
  return {history, store}
}


const style: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND,
  color: colors.TEXT,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: config.font,
  minHeight: '100vh',
}
const pagePadding: React.CSSProperties = {
  paddingBottom: verticalPagePadding,
  paddingLeft: horizontalPagePadding,
  paddingRight: horizontalPagePadding,
  paddingTop: verticalPagePadding,
}
const skipToContentStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND,
  color: colors.TEXT,
}

const UserConnectedPageBase = (): React.ReactElement|null => {
  const [isJobModalOpen, setIsJobModalOpen] = useState(false)
  const userDepartementId = useSelector(
    ({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const userLocale = useSelector(({user}: RootState) => user?.profile?.locale)
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const location = useLocation()
  const {i18n} = useTranslation()
  useEffect(
    () => void dispatch(pageIsLoaded(location)),
    // This effect should only run when the pathname is updated, and when it's updated then we
    // know we get a fresh location object as well.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, location.pathname])
  useEffect(() => {
    const timeout = window.setTimeout(() => window.scroll({top: 0}))
    return () => window.clearTimeout(timeout)
  }, [location.pathname])
  const userFromURL = useMemo((): bayes.bob.User|undefined => {
    const {departement: departementId, gender} = parseQueryString(location.search)
    if (!departementId) {
      return undefined
    }
    return {
      profile: {gender: gender as bayes.bob.Gender, locale: i18n.language || 'fr'},
      projects: [{city: {departementId}}],
    }
  }, [i18n.language, location.search])
  useEffect((): void => {
    if (userFromURL) {
      dispatch(setLocalUser(userFromURL))
    }
  }, [dispatch, userFromURL])
  useEffect((): void => {
    const locale = i18n.language || 'fr'
    if (locale !== userLocale) {
      dispatch(setLocalUserLocale(locale))
    }
  }, [dispatch, i18n.language, userLocale])
  useTrackUtms()

  const hasCoaching = useCoaching()
  const mainStyle = useMemo((): React.CSSProperties => ({
    outline: 0,
    ...pagePadding,
    ...isJobModalOpen && {filter: 'blur(1px)'},
  }), [isJobModalOpen])
  if (!userDepartementId && userFromURL || !userLocale) {
    // Waiting for the userFromURL to be set in Redux.
    return <WaitingPage />
  }
  return <div style={style}>
    <Switch>
      <Route path="/accueil" component={WelcomePage} />
      <Route path={Routes.TERMS_AND_CONDITIONS_PAGE} component={TermsPage} />
      <Route path={Routes.COOKIES_PAGE} component={CookiesPage} />
      {userDepartementId ? null : <Route>
        <Redirect to="/accueil" />
      </Route>}
      <Route path="*">
        <SkipToContent style={skipToContentStyle} />
        <TopBar isBlur={isJobModalOpen} />
        {isMobileVersion ? null : <JobDetailModal setIsJobModalOpen={setIsJobModalOpen} />}
        {hasCoaching ? <CoachingModal /> : null}
        <JobEvaluationModal />
        <NetflixBanner />
        <main role="main" id="main" tabIndex={-1} style={mainStyle}>
          <Switch>
            <Route path="/:sectionId/:romeId" component={JobDetailPage} />
            <Route path="/:sectionId" component={SectionPage} />
            <Route path="/" component={NetflixPage} />
          </Switch>
        </main>
      </Route>
    </Switch>
    <DebugModal />
  </div>
}
const UserConnectedPage = React.memo(UserConnectedPageBase)

const MainSnackbar = connect(
  ({asyncState}: RootState): {snack?: string} => ({
    snack: asyncState.errorMessage,
  }),
  (dispatch: DispatchAllUpskillingActions) => ({
    onHide: (): void => void dispatch(hideToasterMessageAction),
  }),
)(Snackbar)

const App = (): React.ReactElement => {
  const [{history, store}] = useState(createAppState)
  return <Provider store={store}>
    <TabNavigationProvider>
      <Suspense fallback={<WaitingPage />}>
        <div style={{backgroundColor: colors.BACKGROUND_GREY, color: colors.DARK_TWO}}>
          <ConnectedRouter history={history}>
            <UserConnectedPage />
            <MainSnackbar timeoutMillisecs={4000} />
          </ConnectedRouter>
        </div>
      </Suspense>
    </TabNavigationProvider>
  </Provider>
}

export default React.memo(App)

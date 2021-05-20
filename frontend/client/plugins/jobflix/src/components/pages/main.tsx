import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {createBrowserHistory} from 'history'
import React, {Suspense, useEffect, useMemo, useState} from 'react'
import {hot} from 'react-hot-loader/root'
import {useTranslation} from 'react-i18next'
import {Provider, connect, useDispatch, useSelector} from 'react-redux'
import {useLocation, Redirect, Route, Switch} from 'react-router'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'

import 'styles/App.css'

import useMobileViewport from 'hooks/mobile'
import TabNavigationProvider from 'hooks/tab_navigation'
import {RootState, hideToasterMessageAction, pageIsLoaded} from 'store/actions'
import createAmplitudeMiddleware from 'store/amplitude'
import {asyncState} from 'store/app_reducer'
import {init as i18nInit} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {parseQueryString} from 'store/parse'
import createSentryMiddleware from 'store/sentry'

import Snackbar from 'components/snackbar'

import {DispatchAllUpskillingActions, actionTypesToLog, setLocalUser} from '../../store/actions'
import app from '../../store/app_reducer'
import createGoogleAnalyticsMiddleWare from '../../store/google_analytics_new'
import UpskillingLogger from '../../store/logging'
import user from '../../store/user_reducer'

import TopBar from '../top_bar'
import {JobDetailModal} from '../job_detail'
import JobDetailPage from './job_detail'
import NetflixPage from './netflix'
import {horizontalPagePadding, verticalPagePadding} from '../padding'
import SectionPage from './section'
import WaitingPage from './waiting'
import WelcomePage from './welcome'

i18nInit({defaultNS: 'upskilling'})

const createAppState = () => {
  const history = createBrowserHistory(
    window.location.hostname.includes('jobflix') ? {} : {basename: 'orientation'})

  const amplitudeMiddleware =
    createAmplitudeMiddleware(new UpskillingLogger(actionTypesToLog))

  const googleAnalyticsMiddleWare = createGoogleAnalyticsMiddleWare(config.googleUAID, {
    UPSKILLING_EXPLORE_JOB: ['explore', ['sectionId', 'jobName']],
  })
  // Enable devTools middleware.
  const finalCreateStore = composeWithDevTools(
    // sentryMiddleware needs to be first to correctly catch exception down the line.
    applyMiddleware(
      createSentryMiddleware(),
      thunk,
      amplitudeMiddleware,
      googleAnalyticsMiddleWare,
      routerMiddleware(history),
    ),
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
  if (module.hot) {
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
  backgroundColor: colors.PURPLE_BROWN,
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Lato, Helvetica',
  minHeight: '100vh',
}
const pagePadding: React.CSSProperties = {
  paddingBottom: verticalPagePadding,
  paddingLeft: horizontalPagePadding,
  paddingTop: verticalPagePadding,
}

const UserConnectedPageBase = (): React.ReactElement|null => {
  const hasUserLocation = useSelector(
    ({user}: RootState) => !!user?.projects?.[0]?.city?.departementId)
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const location = useLocation()
  const {i18n} = useTranslation()
  useMobileViewport()
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
  if (!hasUserLocation && userFromURL) {
    // Waiting for the userFromURL to be set in Redux.
    return <WaitingPage />
  }
  return <div style={style}>
    <Switch>
      <Route path="/accueil" component={WelcomePage} />
      {hasUserLocation ? null : <Redirect to="/accueil" />}
      <Route path="*">
        <TopBar />
        {isMobileVersion ? null : <JobDetailModal />}
        <div style={pagePadding}>
          <Switch>
            <Route path="/:sectionId/:romeId" component={JobDetailPage} />
            <Route path="/:sectionId" component={SectionPage} />
            <Route path="/" component={NetflixPage} />
          </Switch>
        </div>
      </Route>
    </Switch>
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

export default hot(React.memo(App))

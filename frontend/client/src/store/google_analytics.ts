import Storage from 'local-storage-fallback'
import type {AnyAction, Middleware, MiddlewareAPI} from 'redux'

import type {DispatchAllActions, PageIsLoadedAction, RootState} from './actions'

/* eslint-disable unicorn/no-abusive-eslint-disable */
// Code from https://developers.google.com/analytics/devguides/collection/analyticsjs/
// @ts-ignore
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');  // eslint-disable-line
/* eslint-enable unicorn/no-abusive-eslint-disable */


interface Tracker {
  get: (key: 'clientId') => string
}

type CreateOptions = 'auto' | {
  clientId?: string|null
  storage: 'none'
}


type WindowWithGA = (typeof window) & {
  ga: ((action: 'create', uaid: string, options?: CreateOptions) => void) &
  ((action: 'send', eventName: string, pathname?: string) => void) &
  ((func: (tracker: Tracker) => void) => void)
}

type MiddlewareReturnType = ReturnType<Middleware<unknown, RootState, DispatchAllActions>>


// Name of the local storage key where to keep the GA client ID.
const GALocalStorageKey = 'ga:clientId'
const windowGA = window as WindowWithGA


function createGoogleAnalyticsMiddleWare(
  googleUAID: string, actionsTypesToLog: {[actionType: string]: string}):
  Middleware<unknown, RootState, DispatchAllActions> {
  windowGA.ga('create', googleUAID, {
    clientId: Storage.getItem(GALocalStorageKey),
    storage: 'none',
  })
  windowGA.ga((tracker: Tracker): void => {
    Storage.setItem(GALocalStorageKey, tracker.get('clientId'))
  })
  const handleNextDispatch = (next: DispatchAllActions): ReturnType<MiddlewareReturnType> =>
    (anyAction: AnyAction): ReturnType<ReturnType<MiddlewareReturnType>> => {
      const gaAction = actionsTypesToLog[anyAction.type]
      if (gaAction) {
        const pageIsLoadedAction = anyAction as PageIsLoadedAction
        windowGA.ga(
          'send', gaAction,
          pageIsLoadedAction.location && pageIsLoadedAction.location.pathname || undefined)
      }
      return next(anyAction)
    }
  return (unusedStore: MiddlewareAPI<DispatchAllActions, RootState>): MiddlewareReturnType =>
    handleNextDispatch
}


export default createGoogleAnalyticsMiddleWare

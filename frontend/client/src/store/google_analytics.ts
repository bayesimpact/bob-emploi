import {AnyAction, Middleware, MiddlewareAPI} from 'redux'

import {DispatchAllActions, PageIsLoadedAction, RootState} from './actions'

// Code from https://developers.google.com/analytics/devguides/collection/analyticsjs/
// @ts-ignore
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');  // eslint-disable-line


type WindowWithGA = (typeof window) & {
  ga: ((action: 'create', uaid: string, auto?: 'auto') => void) &
  ((action: 'send', eventName: string, pathname?: string) => void)
}

type MiddlewareReturnType = ReturnType<Middleware<{}, RootState, DispatchAllActions>>


const windowGA = window as WindowWithGA


function createGoogleAnalyticsMiddleWare(
  googleUAID: string, actionsTypesToLog: {[acionType: string]: string}):
  Middleware<{}, RootState, DispatchAllActions> {
  windowGA.ga('create', googleUAID, 'auto')
  return (unusedStore: MiddlewareAPI<DispatchAllActions, RootState>): MiddlewareReturnType =>
    (next: DispatchAllActions): ReturnType<MiddlewareReturnType> =>
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
}


export {createGoogleAnalyticsMiddleWare}

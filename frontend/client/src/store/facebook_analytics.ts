import _mapValues from 'lodash/mapValues'
import {AnyAction, Middleware, MiddlewareAPI} from 'redux'

import {AllActions, DispatchAllActions, RootState} from './actions'

/* eslint-disable unicorn/no-abusive-eslint-disable */
// Code from https://developers.facebook.com/docs/ads-for-websites/pixel-events/v2.12
// @ts-ignore
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');  // eslint-disable-line
/* eslint-enable unicorn/no-abusive-eslint-disable */


type MiddlewareReturnType = ReturnType<Middleware<{}, RootState, DispatchAllActions>>


interface ActionType {
  params?: {}
  predicate?: (action: AnyAction) => boolean
  type: string
}


type WindowWithFbq = (typeof window) & {
  fbq: ((action: 'track', type: string, params?: {}) => void) &
  ((action: 'init', pixelId: string) => void) & {
    disablePushState: boolean
  }
}


const windowFbq = window as WindowWithFbq


function createFacebookAnalyticsMiddleWare(
  facebookPixelID: string,
  actionsTypesToLog: {[actionType in AllActions['type']]?: ActionType|string}):
  Middleware<{}, RootState, DispatchAllActions> {
  // We do not want to use Facebook Analytics to track our page history. We
  // only use it to measure the effectiveness of Facebook ads, therefore
  // sending one PageView is enough.
  windowFbq.fbq.disablePushState = true

  windowFbq.fbq('init', facebookPixelID)
  windowFbq.fbq('track', 'PageView')
  const actionsTypePredicate: {[actionType in AllActions['type']]?: ActionType} = _mapValues(
    actionsTypesToLog,
    (type: (ActionType|string)): ActionType => {
      const typeAsAction = type as ActionType
      if (typeAsAction.predicate) {
        return typeAsAction
      }
      if (typeAsAction.params) {
        return {predicate: (): boolean => true, ...typeAsAction}
      }
      return {predicate: (): boolean => true, type: type as string}
    })

  const handleNextDispatch = (next: DispatchAllActions): ReturnType<MiddlewareReturnType> =>
    (anyAction: AnyAction): ReturnType<ReturnType<MiddlewareReturnType>> => {
      const {params = undefined, predicate = undefined, type = undefined} =
        actionsTypePredicate[anyAction.type] || {}
      if (predicate && type && predicate(anyAction)) {
        windowFbq.fbq('track', type, params)
      }
      return next(anyAction)
    }
  return (unusedStore: MiddlewareAPI<DispatchAllActions, RootState>): MiddlewareReturnType =>
    handleNextDispatch
}


export {createFacebookAnalyticsMiddleWare}

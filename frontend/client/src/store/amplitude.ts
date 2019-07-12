import {AmplitudeClient} from 'amplitude-js'
import _isEqual from 'lodash/isEqual'
import _pickBy from 'lodash/pickBy'
import {parse} from 'query-string'
import {AnyAction, Middleware, MiddlewareAPI} from 'redux'

import {AllActions, DispatchAllActions, RootState} from './actions'
import {Logger} from './logging'


interface AmplitudeDefer {
  amplitude?: AmplitudeClient
  callbacks: ((amplitude: AmplitudeClient) => void)[]
}


type MiddlewareReturnType = ReturnType<Middleware<{}, RootState, DispatchAllActions>>


export const createAmplitudeMiddleware =
  (actionTypesToLog): Middleware<{}, RootState, DispatchAllActions> => {
    const defer: AmplitudeDefer = {callbacks: []}
    import(/* webpackChunkName: "amplitude" */ 'amplitude-js').then(
      ({default: amplitudeJs}): void => {
        defer.amplitude = amplitudeJs.getInstance()
        defer.amplitude.setVersionName(config.clientVersion)
        // More info about Amplitude client options:
        // https://amplitude.zendesk.com/hc/en-us/articles/115001361248#settings-configuration-options
        defer.amplitude.init(config.amplitudeToken, null, {
          includeGclid: true,
          includeReferrer: true,
          includeUtm: true,
          saveParamsReferrerOncePerSession: false,
        })
        defer.callbacks.forEach((callback): void => callback(defer.amplitude))
      })

    const logger = new Logger(actionTypesToLog)
    let userId, userProps, utms
    return (store: MiddlewareAPI<DispatchAllActions, RootState>): MiddlewareReturnType =>
      (next: DispatchAllActions): ReturnType<MiddlewareReturnType> =>
        (anyAction: AnyAction): ReturnType<ReturnType<MiddlewareReturnType>> => {
          const action = anyAction as AllActions
          const logToAmplitude = (amplitude: AmplitudeClient): void => {
            const state = store.getState()

            const newUserId = logger.getUserId(action, state)
            if (newUserId !== userId) {
              userId = newUserId || null
              amplitude.setUserId(userId)
            }

            if (logger.shouldLogAction(action)) {
              amplitude.logEvent(
                logger.getEventName(action),
                logger.getEventProperties(action, state))
              const newUserProps = logger.getUserProperties(action, state)
              const newUtms = {
                ...utms,
                ..._pickBy(
                  parse(window.location.search), (value, key): boolean => key.startsWith('utm_')),
              }
              if (!_isEqual(userProps, newUserProps) || !_isEqual(utms, newUtms)) {
                userProps = newUserProps
                utms = newUtms
                const identify = new amplitude.Identify()
                Object.keys(userProps).forEach((key): void => {
                  identify.set(key, userProps[key])
                })
                Object.keys(utms).forEach((key): void => {
                  identify.set(key, utms[key])
                  identify.setOnce(`initial_${key}`, utms[key])
                })
                amplitude.identify(identify)
              }
            }
          }

          if (defer.amplitude) {
            logToAmplitude(defer.amplitude)
          } else {
            defer.callbacks.push(logToAmplitude)
          }

          return next(action)
        }
  }

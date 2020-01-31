import {AmplitudeClient} from 'amplitude-js'
import _isEqual from 'lodash/isEqual'
import _pickBy from 'lodash/pickBy'
import {Action, Dispatch, AnyAction, Middleware, MiddlewareAPI} from 'redux'

import {parseQueryString} from './parse'


interface AmplitudeDefer {
  amplitude?: AmplitudeClient
  callbacks: ((amplitude: AmplitudeClient) => void)[]
}


type MiddlewareReturnType<State> = ReturnType<Middleware<{}, State, Dispatch<AnyAction>>>


interface Properties {
  [feature: string]: string | readonly string[] | boolean | number
}


interface AmplitudeLogger<Action, State> {
  getEventName(action: Action): string
  getEventProperties(action: Action, state: State): Properties
  getUserId(action: Action, state: State): string|undefined
  getUserProperties(action: Action, state: State): Properties|null
  shouldLogAction(action: Action): boolean
}


export const createAmplitudeMiddleware =
  <A extends Action, State>(
    logger: AmplitudeLogger<A, State>, amplitudeToken = config.amplitudeToken):
  Middleware<{}, State, Dispatch<AnyAction>> => {
    const defer: AmplitudeDefer = {callbacks: []}
    import(/* webpackChunkName: "amplitude" */ 'amplitude-js').then(
      ({default: amplitudeJs}): void => {
        const instance = amplitudeJs.getInstance()
        defer.amplitude = instance
        instance.setVersionName(config.clientVersion)
        // More info about Amplitude client options:
        // https://amplitude.zendesk.com/hc/en-us/articles/115001361248#settings-configuration-options
        instance.init(amplitudeToken, undefined, {
          includeGclid: true,
          includeReferrer: true,
          includeUtm: true,
          saveParamsReferrerOncePerSession: false,
        })
        defer.callbacks.forEach((callback): void => callback(instance))
      })

    let userId: string|null
    let userProps: Properties|undefined
    let utms: {[key: string]: string}
    return (store: MiddlewareAPI<Dispatch<AnyAction>, State>): MiddlewareReturnType<State> =>
      (next: Dispatch<AnyAction>): ReturnType<MiddlewareReturnType<State>> =>
        (anyAction: AnyAction): ReturnType<ReturnType<MiddlewareReturnType<State>>> => {
          const action = anyAction as A
          const logToAmplitude = (amplitude: AmplitudeClient): void => {
            const state = store.getState()

            const newUserId = logger.getUserId(action, state) || null
            if (newUserId !== userId) {
              userId = newUserId
              amplitude.setUserId(userId)
            }

            if (logger.shouldLogAction(action)) {
              amplitude.logEvent(
                logger.getEventName(action),
                logger.getEventProperties(action, state))
              const newUserProps = logger.getUserProperties(action, state) || undefined
              const newUtms = {
                ...utms,
                ..._pickBy(
                  parseQueryString(window.location.search),
                  (value, key): boolean => key.startsWith('utm_')),
              }
              if (!_isEqual(userProps, newUserProps) || !_isEqual(utms, newUtms)) {
                userProps = newUserProps
                utms = newUtms
                const identify = new amplitude.Identify()
                if (userProps) {
                  Object.keys(userProps).forEach((key: string): void => {
                    if (userProps) {
                      identify.set(key, userProps[key])
                    }
                  })
                }
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

          return next(anyAction)
        }
  }

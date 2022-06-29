import type {AmplitudeClient} from 'amplitude-js'
import _isEqual from 'lodash/isEqual'
import _pickBy from 'lodash/pickBy'
import type {Action, Dispatch, AnyAction, Middleware, MiddlewareAPI} from 'redux'

import {parseQueryString} from './parse'


interface AmplitudeDefer {
  amplitude?: AmplitudeClient
  callbacks: ((amplitude: AmplitudeClient) => void)[]
}


type MiddlewareReturnType<State> = ReturnType<Middleware<unknown, State, Dispatch<AnyAction>>>


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


const initAmplitude = async (defer: AmplitudeDefer, token: string): Promise<void> => {
  const {default: amplitudeJs} = await import(/* webpackChunkName: "amplitude" */ 'amplitude-js')
  const instance = amplitudeJs.getInstance()
  defer.amplitude = instance
  instance.setVersionName(config.clientVersion)
  // More info about Amplitude client options:
  // https://amplitude.zendesk.com/hc/en-us/articles/115001361248#settings-configuration-options
  instance.init(token, undefined, {
    batchEvents: true,
    disableCookies: true,
    eventUploadPeriodMillis: 500,
    includeGclid: true,
    includeReferrer: true,
    includeUtm: true,
    saveParamsReferrerOncePerSession: false,
    storage: 'sessionStorage',
  })
  for (const callback of defer.callbacks) {
    callback(instance)
  }
}


export default <A extends Action, State>(
  logger: AmplitudeLogger<A, State>, amplitudeToken = config.amplitudeToken):
Middleware<unknown, State, Dispatch<AnyAction>> => {
  const defer: AmplitudeDefer = {callbacks: []}
  initAmplitude(defer, amplitudeToken)

  let userId: string|null = null
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
            if (!userId) {
              amplitude.regenerateDeviceId()
            }
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
                for (const [key, userProp] of Object.entries(userProps)) {
                  if (userProps) {
                    identify.set(key, userProp)
                  }
                }
              }
              for (const [key, value] of Object.entries(utms)) {
                identify.set(key, value)
                identify.setOnce(`initial_${key}`, value)
              }
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

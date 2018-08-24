import _isEqual from 'lodash/isEqual'
import {Logger} from './logging'


export const createAmplitudeMiddleware = actionTypesToLog => {
  const defer = {callbacks: []}
  import(/* webpackChunkName: "amplitude" */ 'amplitude-js').then(({default: amplitudeJs}) => {
    defer.amplitude = amplitudeJs.getInstance()
    // More info about Amplitude client options:
    // https://github.com/amplitude/Amplitude-Javascript#configuration-options
    defer.amplitude.init(config.amplitudeToken, null, {
      includeGclid: true,
      includeReferrer: true,
      includeUtm: true,
      saveParamsReferrerOncePerSession: false,
    })
    defer.callbacks.forEach(callback => callback(defer.amplitude))
  })

  const logger = new Logger(actionTypesToLog)
  let userId, userProps
  return store => next => action => {
    const logToAmplitude = amplitude => {
      const state = store.getState()

      const newUserId = logger.getUserId(action, state)
      if (newUserId !== userId) {
        userId = newUserId || null
        amplitude.setUserId(userId)
      }

      if (logger.shouldLogAction(action)) {
        amplitude.logEvent(logger.getEventName(action), logger.getEventProperties(action, state))
        const newUserProps = logger.getUserProperties(action, state)
        if (!_isEqual(userProps, newUserProps)) {
          userProps = newUserProps
          amplitude.setUserProperties(userProps)
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

import * as Sentry from '@sentry/browser'
import createMiddleware from 'redux-sentry-middleware'

Sentry.init({
  dsn: config.sentryDSN,
  release: config.clientVersion,
})

const createSentryMiddleware = (): ReturnType<typeof createMiddleware> => createMiddleware(Sentry, {
  stateTransformer: function<T extends {user: unknown}>(state: T): T & {user: string} {
    return {
      ...state,
      // Don't send user info to Sentry.
      user: 'Removed with sentryMiddleware stateTransformer',
    }
  },
})

export {createSentryMiddleware}

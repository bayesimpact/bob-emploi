import * as Sentry from '@sentry/browser'
import createMiddleware from 'redux-sentry-middleware'

const createSentryMiddleware = (dsn = config.sentryDSN): ReturnType<typeof createMiddleware> => {
  Sentry.init({
    dsn,
    release: config.clientVersion,
  })
  return createMiddleware(Sentry, {
    stateTransformer: function<T extends {user: unknown}>(state: T): T & {user: string} {
      return {
        ...state,
        // Don't send user info to Sentry.
        user: 'Removed with sentryMiddleware stateTransformer',
      }
    },
  })
}

export {createSentryMiddleware}

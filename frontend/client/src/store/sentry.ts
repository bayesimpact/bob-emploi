import * as Sentry from '@sentry/browser'
import {createReduxEnhancer} from '@sentry/react'

const createSentryEnhancer = (dsn = config.sentryDSN): ReturnType<typeof createReduxEnhancer> => {
  Sentry.init({
    dsn,
    // TODO(pascal): Investigate why we have so many and how we should fix them.
    ignoreErrors: ['ChunkLoadError'],
    release: config.clientVersion,
  })
  return createReduxEnhancer({
    stateTransformer: function<T extends {user: unknown}>(state: T): T & {user: string} {
      return {
        ...state,
        // Don't send user info to Sentry.
        user: 'Removed with sentryMiddleware stateTransformer',
      }
    },
  })
}

export default createSentryEnhancer

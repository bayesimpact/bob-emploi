import {RavenOptions} from 'raven-js'
import {Action, Dispatch, Middleware, Store} from 'redux'


interface Options<S, A extends Action> {
  readonly actionTransformer?: (action: A) => any
  readonly logger?: (error: Error) => void
  readonly stateTransformer?: (state: S) => any
}


declare function createMiddleware<S, D extends Dispatch, A extends Action>(
  dsn: string, cfg: RavenOptions, options: Options<S, A>): Middleware<{}, S, D>


export = createMiddleware

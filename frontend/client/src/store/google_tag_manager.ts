import type {AnyAction, Middleware, MiddlewareAPI} from 'redux'

import type {AllActions, DispatchAllActions, RootState} from './actions'

type MiddlewareReturnType = ReturnType<Middleware<unknown, RootState, DispatchAllActions>>

interface GAEvent {
  'event': string
  'gtm.start': number
}

type WindowWithGA = Window & {
  dataLayer?: GAEvent[]
}

// See https://developers.google.com/tag-manager/quickstart
const activateGTM = config.googleTMID ?
  (w: WindowWithGA = window, d: Document = document): void => {
    const scriptSrc = `https://www.googletagmanager.com/gtm.js?id=${config.googleTMID}`
    if (d.querySelector(`script[src="${scriptSrc}"]`)) {
      return
    }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({
      'event': 'gtm.js',
      'gtm.start': Date.now(),
    })
    const f = d.getElementsByTagName('script')[0]
    const j = d.createElement('script')
    j.async = true
    j.src = scriptSrc
    f.parentNode?.insertBefore(j, f)
  } : () => void 0

const handleNextDispatch = (next: DispatchAllActions): ReturnType<MiddlewareReturnType> =>
  (anyAction: AnyAction): ReturnType<ReturnType<MiddlewareReturnType>> => {
    if ((anyAction as AllActions).type === 'AUTHENTICATE_USER') {
      activateGTM()
    }
    return next(anyAction)
  }

export default (): Middleware<unknown, RootState, DispatchAllActions> =>
  (unusedStore: MiddlewareAPI<DispatchAllActions, RootState>): MiddlewareReturnType =>
    handleNextDispatch

// TODO(cyrille): Move to main store if we add new GA accounts in other plugins.
import _pick from 'lodash/pick'
import {AnyAction, Middleware} from 'redux'

import {RootState} from 'store/actions'

import {AllUpskillingActions, DispatchAllUpskillingActions} from './actions'

interface GAEvent {
  event: string
  [property: string]: string|number|undefined
}

type GAData = GAEvent | IArguments
type WindowWithGA = (typeof window) & {
  dataLayer: GAData[]
}

const windowGA = window as WindowWithGA
function gtag() {
  // eslint-disable-next-line prefer-rest-params
  windowGA.dataLayer.push(arguments)
}


type MiddlewareReturnType = ReturnType<Middleware<unknown, RootState, DispatchAllUpskillingActions>>

// TODO(cyrille): Strong type the properties to be keys of the specific Action.
type LoggedAction = [string, readonly string[]]
type ActionsToLog = {[action in AllUpskillingActions['type']]?: LoggedAction}

function createGoogleAnalyticsMiddleWare(googleUAID: string, actionsTypesToLog: ActionsToLog):
Middleware<unknown, RootState, DispatchAllUpskillingActions> {
  const googleJs = document.createElement('script')
  googleJs.setAttribute('async', '')
  googleJs.setAttribute('src', `https://www.googletagmanager.com/gtag/js?id=${googleUAID}`)
  document.head.appendChild(googleJs)
  windowGA.dataLayer = windowGA.dataLayer || []
  // @ts-ignore
  gtag('js', new Date())
  // @ts-ignore
  gtag('config', googleUAID)
  const handleNextDispatch =
    (next: DispatchAllUpskillingActions): ReturnType<MiddlewareReturnType> =>
      (anyAction: AnyAction): ReturnType<ReturnType<MiddlewareReturnType>> => {
        const [gaAction, properties] =
          actionsTypesToLog[(anyAction as AllUpskillingActions).type] || []
        if (gaAction) {
          windowGA.dataLayer.push({event: gaAction, ..._pick(anyAction, properties || [])})
        }
        return next(anyAction)
      }
  return unusedStore => handleNextDispatch
}


export default createGoogleAnalyticsMiddleWare

import Storage from 'local-storage-fallback'
import _keyBy from 'lodash/keyBy'
import {Action} from 'redux'

import {AllActions, AsyncAction} from './actions'

// Name of the cookie to accept cookies.
const ACCEPT_COOKIES_COOKIE_NAME = 'accept-cookies'
// Name of the cookie to store the auth token.
const AUTH_TOKEN_COOKIE_NAME = 'authToken'
// Name of the local storage key to store the UTM initial information.
const UTM_LOCAL_STORAGE_NAME = 'utm'
// Name of the local storage key to store the initial information on unregistered features.
const FEATURES_LOCAL_STORAGE_NAME = 'features'


function dropKey<K extends string, M>(data: M, key: K): Omit<M, K> {
  const {[key]: omittedKey, ...remaining} = data
  return remaining
}


function getJsonFromStorage<T>(storageKey: string): T|null {
  const storedJson = Storage.getItem(storageKey)
  if (!storedJson) {
    return null
  }
  return JSON.parse(storedJson) as T
}


export function setJsonToStorage(storageKey: string, value: unknown): void {
  Storage.setItem(storageKey, JSON.stringify(value))
}


function setOnceJsonToStorage(storageKey: string, value: unknown): void {
  if (Storage.getItem(storageKey)) {
    return
  }
  setJsonToStorage(storageKey, value)
}


function isTimestampInCookieBeforeNow(cookieName: string): boolean {
  const cookieValue = Storage.getItem(cookieName)
  if (!cookieValue) {
    return false
  }
  return new Date(Number.parseInt(cookieValue)) > new Date()
}


const {quickDiagnostic: omittedQuickDiagnostic,
  ...initialFeatures}: InitialFeatures =
  getJsonFromStorage<InitialFeatures>(FEATURES_LOCAL_STORAGE_NAME) || {}

export const appInitialData: AppState = {
  // Cache for advice data. It is organized as a map of maps: the first key
  // being the project ID and the second one the advice ID.
  adviceData: {},
  // Cache for advice tips for each advice module for each project.
  adviceTips: {},
  // Cache of job application modes.
  applicationModes: {},
  // Authentication token.
  authToken: Storage.getItem(AUTH_TOKEN_COOKIE_NAME) || undefined,
  // Default props to use when creating a new project.
  defaultProjectProps: {},
  // Whether the app loading time has already been measured.
  hasLoadedApp: false,
  // Default for props storing if user has seen Bob Sharing modal.
  hasSeenShareModal: false,
  // Whether the user used an expired token, so that they can ask for a new one in an email.
  hasTokenExpired: false,
  // TODO(cyrille): Set as null if empty.
  initialFeatures,
  initialUtm: getJsonFromStorage(UTM_LOCAL_STORAGE_NAME) || undefined,
  isMobileVersion: false,
  // Cache for full jobGroupInfos.
  jobGroupInfos: {},
  // Cache of job requirements.
  jobRequirements: {},
  // Cache of labor stats per project.
  laborStats: {},
  lastAccessAt: undefined,
  // Cache for local stats.
  localStats: {},
  loginModal: undefined,
  // Cache for specific jobs.
  mainChallengesUserCount: {},
  quickDiagnostic: {
    after: {},
    before: {},
  },
  // Cache for specific jobs.
  specificJobs: {},
  userHasAcceptedCookiesUsage: isTimestampInCookieBeforeNow(ACCEPT_COOKIES_COOKIE_NAME),
}


export const addIfKeyExists = <CacheType, K extends keyof CacheType>(
  cacheField: undefined|CacheType,
  key?: K,
  value?: CacheType[K],
): undefined|CacheType => {
  if (!key || value === undefined) {
    return cacheField
  }
  return {
    ...cacheField,
    [key]: value,
  } as CacheType
}

function app(state: AppState = appInitialData, action: AllActions): AppState {
  switch (action.type) {
    case 'LOAD_LANDING_PAGE':
    case 'START_AS_GUEST':
      return {
        ...state,
        defaultProjectProps: {
          ...state.defaultProjectProps,
          ...action.defaultProjectProps,
        },
      }
    case 'PAGE_IS_LOADED':
      return {
        ...state,
        hasLoadedApp: true,
      }
    case 'GET_EXPANDED_CARD_CONTENT':
      if (action.status === 'success' && action.project.projectId && action.advice.adviceId) {
        return {
          ...state,
          adviceData: {
            ...state.adviceData,
            [action.project.projectId]: {
              ...state.adviceData[action.project.projectId],
              [action.advice.adviceId]: action.response,
            },
          },
        }
      }
      return state
    case 'OPEN_LOGIN_MODAL':
      return {...state, loginModal: {defaultValues: {
        isReturningUser: true,
        ...action.defaultValues,
      }}}
    case 'OPEN_REGISTER_MODAL':
      return {...state, loginModal: {defaultValues: action.defaultValues || {}}}
    case 'CLOSE_LOGIN_MODAL':
      return {
        ...state,
        loginModal: undefined,
      }
    case 'REMOVE_AUTH_DATA':
      Storage.removeItem(AUTH_TOKEN_COOKIE_NAME)
      return {
        ...state,
        authToken: undefined,
      }
    case 'GET_JOBS':
      if (action.status === 'success' && action.romeId) {
        return {
          ...state,
          specificJobs: {
            ...state.specificJobs,
            [action.romeId]: action.response || undefined,
          },
        }
      }
      break
    // TODO(cyrille): Merge the different fetch APIs for job group infos.
    case 'GET_APPLICATION_MODES':
      if (action.status === 'success' && action.romeId && action.response.applicationModes) {
        return {
          ...state,
          applicationModes: {
            ...state.applicationModes,
            [action.romeId]: action.response.applicationModes,
          },
        }
      }
      break
    case 'GET_PROJECT_REQUIREMENTS':
      if (action.status === 'success' && action.project.targetJob &&
        action.project.targetJob.codeOgr) {
        return {
          ...state,
          jobRequirements: {
            ...state.jobRequirements,
            [action.project.targetJob.codeOgr]: action.response,
          },
        }
      }
      break
    case 'GET_MAIN_CHALLENGES_USERS_COUNT':
      if (action.status === 'success') {
        return {
          ...state,
          mainChallengesUserCount: action.response?.mainChallengeCounts,
        }
      }
      break
    case 'ACCEPT_COOKIES_USAGE':
      // 604800000 is the number of milliseconds in a week.
      Storage.setItem(ACCEPT_COOKIES_COOKIE_NAME, (Date.now() + 604_800_000) + '')
      return {
        ...state,
        userHasAcceptedCookiesUsage: true,
      }
    case 'SWITCH_TO_MOBILE_VERSION':
      return {
        ...state,
        isMobileVersion: true,
      }
    case 'LOGOUT': // Fallthrough intended.
    case 'DELETE_USER_DATA':
      Storage.removeItem(AUTH_TOKEN_COOKIE_NAME)
      return {...state, adviceData: {}, adviceTips: {}, authToken: undefined}
    case 'GET_ADVICE_TIPS':
      if (action.status !== 'success' || !action.advice.adviceId || !action.project.projectId) {
        return state
      }
      return {
        ...state,
        adviceTips: {
          ...state.adviceTips,
          [action.project.projectId]: {
            ...(state.adviceTips && state.adviceTips[action.project.projectId] || {}),
            [action.advice.adviceId]: action.response as {actionId: string}[],
          },
        },
      }
    case 'MODIFY_PROJECT':
      if (!action.project.projectId) {
        return state
      }
      return {
        ...state,
        adviceData: dropKey(state.adviceData, action.project.projectId),
      }
    case 'GET_LOCAL_STATS':
      if (action.status === 'success') {
        const romeId = action.project?.targetJob?.jobGroup?.romeId || ''
        const departementId = action.project?.city?.departementId || ''
        const localId = `${romeId}:${departementId}`
        return {
          ...state,
          jobGroupInfos: addIfKeyExists(
            state.jobGroupInfos,
            romeId,
            action.response.jobGroupInfo || {},
          ),
          laborStats: addIfKeyExists(
            state.laborStats,
            localId,
            action.response,
          ),
          localStats: addIfKeyExists(
            state.localStats,
            localId,
            action.response.localStats || {},
          ),
        }
      }
      return state
    case 'TRACK_INITIAL_UTM':
      if (!state.initialUtm && action.utm) {
        setOnceJsonToStorage(UTM_LOCAL_STORAGE_NAME, action.utm)
      }
      return {
        ...state,
        initialUtm: state.initialUtm || action.utm,
      }
    case 'TRACK_INITIAL_FEATURES':
      if (!state.initialFeatures && action.features) {
        setOnceJsonToStorage(FEATURES_LOCAL_STORAGE_NAME, action.features)
      }
      return {
        ...state,
        initialFeatures: state.initialFeatures || action.features,
      }
    case 'AUTHENTICATE_USER':
      if (action.status !== 'success') {
        return state
      }
      if (!action.response.authToken) {
        return {
          ...state,
          hasTokenExpired: action.response.hasTokenExpired,
        }
      }
      Storage.setItem(AUTH_TOKEN_COOKIE_NAME, action.response.authToken)
      return {
        ...state,
        authToken: action.response.authToken,
        lastAccessAt: action.response.lastAccessAt,
      }
    case 'WILL_ACTIVATE_DEMO':
      return {
        ...state,
        demo: action.demo,
      }
    case 'ACTIVATE_DEMO':
      return dropKey(state, 'demo')
    case 'SHARE_PRODUCT_MODAL_IS_SHOWN':
      return {
        ...state,
        hasSeenShareModal: true,
      }
    case 'DIAGNOSE_ONBOARDING':
      if (action.status === 'success') {
        const {comments = []} = action.response
        // TODO(cyrille): first group by field, then split by isBeforeQuestion.
        return {
          ...state,
          quickDiagnostic: {
            after: {
              ...(state.quickDiagnostic && state.quickDiagnostic.after),
              ..._keyBy(
                comments.filter((c): c is bayes.bob.DiagnosticComment & {field: string} =>
                  !c.isBeforeQuestion && !!c.field), 'field'),
            },
            before: {
              ...(state.quickDiagnostic && state.quickDiagnostic.before),
              ..._keyBy(
                comments.filter((c): c is bayes.bob.DiagnosticComment & {field: string} =>
                  !!c.isBeforeQuestion && !!c.field), 'field'),
            },
          },
        }
      }
      return state
    case 'ONBOARDING_COMMENT_IS_SHOWN':
      return {
        ...state,
        quickDiagnostic: {
          after: {
            ...(state.quickDiagnostic && state.quickDiagnostic.after),
            ...(!action.comment.isBeforeQuestion ? {[action.comment.field]: {
              field: action.comment.field,
              ...state.quickDiagnostic && state.quickDiagnostic.after[action.comment.field],
              hasBeenShown: true,
            }} : undefined),
          },
          before: {
            ...(state.quickDiagnostic && state.quickDiagnostic.before),
            ...(action.comment.isBeforeQuestion ? {[action.comment.field]: {
              field: action.comment.field,
              ...state.quickDiagnostic && state.quickDiagnostic.before[action.comment.field],
              hasBeenShown: true,
            }} : undefined),
          },
        },
      }
    case 'COMMENT_IS_SHOWN':
      return {
        ...state,
        hasSeenComment: {
          ...state.hasSeenComment,
          [action.commentKey]: true,
        },
      }
    case 'GET_DIAGNOSTIC_MAIN_CHALLENGES':
      if (action.status === 'success') {
        return {
          ...state,
          diagnosticMainChallenges: {
            ...state.diagnosticMainChallenges,
            [action.key]: action.response,
          },
        }
      }
  }
  return state
}

const asyncInitialData = {
  errorMessage: undefined,
  isFetching: {},
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function isAsyncAction(action: Action<any>): action is AsyncAction<any, any> {
  return !!(action as AsyncAction<any, any>).ASYNC_MARKER
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function asyncState(state: AsyncState<AllActions> = asyncInitialData, action: AllActions):
AsyncState<AllActions> {
  if (action.type === 'HIDE_TOASTER_MESSAGE') {
    return {...state, errorMessage: undefined}
  }
  if (action.type === 'DISPLAY_TOAST_MESSAGE') {
    return {...state, errorMessage: action.error}
  }
  if (!isAsyncAction(action)) {
    return state
  }
  const authAction = action as {response: bayes.bob.AuthResponse}
  if (action.status === 'error' || authAction.response && authAction.response.errorMessage) {
    const errorMessage = (action.status === 'error') ?
      (action.ignoreFailure || !action.error) ? '' : action.error.toString() :
      authAction.response.errorMessage
    return {
      ...dropKey(state, 'authMethod'),
      errorMessage,
      isFetching: {...state.isFetching, [action.fetchingKey || action.type]: false},
    }
  }
  if (action.status === 'success') {
    return {
      ...dropKey(state, 'authMethod'),
      errorMessage: undefined,
      isFetching: {...state.isFetching, [action.fetchingKey || action.type]: false},
    }
  }
  const isFetching = {...state.isFetching, [action.fetchingKey || action.type]: true}
  if (action.type === 'AUTHENTICATE_USER' || action.type === 'EMAIL_CHECK') {
    return {
      ...state,
      authMethod: action.method || state.authMethod,
      isFetching,
    }
  }
  return {
    ...state,
    isFetching,
  }
}


export {app, asyncState, getJsonFromStorage}

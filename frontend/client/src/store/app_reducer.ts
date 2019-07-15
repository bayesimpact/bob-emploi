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


function getJsonFromStorage<T extends {}>(storageKey: string): T {
  const storedJson = Storage.getItem(storageKey)
  if (!storedJson) {
    return null
  }
  return JSON.parse(storedJson) as T
}


function setOnceJsonToStorage(storageKey: string, value: {}): void {
  if (Storage.getItem(storageKey)) {
    return
  }
  Storage.setItem(storageKey, JSON.stringify(value))
}


const {quickDiagnostic: omittedQuickDiagnostic,
  ...initialFeatures}: InitialFeatures =
  getJsonFromStorage<InitialFeatures>(FEATURES_LOCAL_STORAGE_NAME) || {}

const appInitialData = {
  // Cache for advice data. It is organized as a map of maps: the first key
  // being the project ID and the second one the advice ID.
  adviceData: {},
  // Cache for advice tips for each advice module for each project.
  adviceTips: {},
  // Cache of job application modes.
  applicationModes: {},
  // Authentication token.
  authToken: Storage.getItem(AUTH_TOKEN_COOKIE_NAME),
  // Default props to use when creating a new project.
  defaultProjectProps: {},
  // Default for props storing if user has seen Bob Sharing modal.
  hasSeenShareModal: false,
  // TODO(cyrille): Set as null if empty.
  initialFeatures,
  initialUtm: getJsonFromStorage(UTM_LOCAL_STORAGE_NAME),
  isMobileVersion: false,
  // Cache of job requirements.
  jobRequirements: {},
  lastAccessAt: null,
  loginModal: null,
  newProjectProps: {},
  quickDiagnostic: {
    after: {},
    before: {},
  },
  // Cache for specific jobs.
  specificJobs: {},
  // Cache for submetric visibility in diagnostic. It's a map with
  // submetric topics as key and a boolean as visibility status.
  submetricsExpansion: {},
  userHasAcceptedCookiesUsage:
    new Date(parseInt(Storage.getItem(ACCEPT_COOKIES_COOKIE_NAME))) > new Date(),
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
    case 'GET_EXPANDED_CARD_CONTENT':
      if (action.status === 'success' && action.project) {
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
        loginModal: null,
      }
    case 'REMOVE_AUTH_DATA':
      Storage.removeItem(AUTH_TOKEN_COOKIE_NAME)
      return {
        ...state,
        authToken: null,
      }
    case 'GET_JOBS':
      if (action.status === 'success' && action.romeId) {
        return {
          ...state,
          specificJobs: {
            ...state.specificJobs,
            [action.romeId]: action.response,
          },
        }
      }
      break
    // TODO(cyrille): Merge the different fetch APIs for job group infos.
    case 'GET_APPLICATION_MODES':
      if (action.status === 'success' && action.romeId) {
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
      if (action.status === 'success' && action.project) {
        return {
          ...state,
          jobRequirements: {
            ...state.jobRequirements,
            [action.project.targetJob.codeOgr]:
              action.response as {diplomas: string[]; drivingLicenses: string[]},
          },
        }
      }
      break
    case 'ACCEPT_COOKIES_USAGE':
      // 604800000 is the number of milliseconds in a week.
      Storage.setItem(ACCEPT_COOKIES_COOKIE_NAME, (new Date().getTime() + 604800000) + '')
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
      return {...state, adviceData: {}, adviceTips: {}, authToken: null}
    case 'GET_ADVICE_TIPS':
      if (action.status !== 'success' || !action.advice || !action.project) {
        return state
      }
      return {
        ...state,
        adviceTips: {
          ...state.adviceTips,
          [action.project.projectId]: {
            ...(state.adviceTips[action.project.projectId] || {}),
            [action.advice.adviceId]: action.response as {actionId: string}[],
          },
        },
      }
    case 'MODIFY_PROJECT':
      return {
        ...state,
        adviceData: dropKey(state.adviceData, action.project.projectId),
      }
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
      if (action.status !== 'success' || !action.response.authToken) {
        return state
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
    case 'PRODUCT_UPDATED_PAGE_IS_SHOWN':
      return dropKey(state, 'lastAccessAt')
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
              ...state.quickDiagnostic.after,
              ..._keyBy(
                comments.filter(({isBeforeQuestion}): boolean => !isBeforeQuestion), 'field'),
            },
            before: {
              ...state.quickDiagnostic.before,
              ..._keyBy(
                comments.filter(({isBeforeQuestion}): boolean => isBeforeQuestion), 'field'),
            },
          },
        }
      }
      return state
    case 'CHANGE_SUBMETRIC_EXPANSION':
      return {
        ...state,
        submetricsExpansion: {
          ...state.submetricsExpansion,
          [action.topic]: action.isExpanded,
        },
      }
  }
  return state
}

const asyncInitialData = {
  errorMessage: null,
  isFetching: {},
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function isAsyncAction(action: Action<any>): action is AsyncAction<any, any> {
  return !!(action as AsyncAction<any, any>).ASYNC_MARKER
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function asyncState(state: AsyncState = asyncInitialData, action: AllActions): AsyncState {
  if (action.type === 'HIDE_TOASTER_MESSAGE') {
    return {...state, errorMessage: null}
  }
  if (action.type === 'DISPLAY_TOAST_MESSAGE') {
    return {...state, errorMessage: action.error}
  }
  if (!isAsyncAction(action)) {
    return state
  }
  if (action.status === 'error') {
    return {
      ...dropKey(state, 'authMethod'),
      errorMessage: (action.ignoreFailure || !action.error) ? '' : action.error.toString(),
      isFetching: {...state.isFetching, [action.type]: false},
    }
  }
  if (action.status === 'success') {
    return {
      ...dropKey(state, 'authMethod'),
      errorMessage: null,
      isFetching: {...state.isFetching, [action.type]: false},
    }
  }
  const isFetching = {...state.isFetching, [action.type]: true}
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


export {app, asyncState}

import Storage from 'local-storage-fallback'
import _keyBy from 'lodash/keyBy'
import _omit from 'lodash/omit'

import {AUTHENTICATE_USER, HIDE_TOASTER_MESSAGE, DISPLAY_TOAST_MESSAGE,
  GET_PROJECT_REQUIREMENTS, LOAD_LANDING_PAGE, TRACK_INITIAL_UTM, TRIGGER_QUICK_DIAGNOSTIC,
  OPEN_LOGIN_MODAL, CLOSE_LOGIN_MODAL, GET_JOBS, ACCEPT_COOKIES_USAGE,
  SWITCH_TO_MOBILE_VERSION, LOGOUT, DELETE_USER_DATA, GET_ADVICE_TIPS,
  MODIFY_PROJECT, OPEN_REGISTER_MODAL, PRODUCT_UPDATED_PAGE_IS_SHOWN,
  GET_EXPANDED_CARD_CONTENT, ACTIVATE_DEMO, WILL_ACTIVATE_DEMO, TRACK_INITIAL_FEATURES,
  SHARE_PRODUCT_MODAL_IS_SHOWN, DIAGNOSE_ONBOARDING,
  CHANGE_SUBMETRIC_EXPANSION} from './actions'

// Name of the cookie to accept cookies.
const ACCEPT_COOKIES_COOKIE_NAME = 'accept-cookies'
// Name of the cookie to store the auth token.
const AUTH_TOKEN_COOKIE_NAME = 'authToken'
// Name of the local storage key to store the UTM initial information.
const UTM_LOCAL_STORAGE_NAME = 'utm'
// Name of the local storage key to store the initial information on unregistered features.
const FEATURES_LOCAL_STORAGE_NAME = 'features'


function getJsonFromStorage(storageKey) {
  const storedJson = Storage.getItem(storageKey)
  if (!storedJson) {
    return null
  }
  return JSON.parse(storedJson)
}


function setOnceJsonToStorage(storageKey, value) {
  if (Storage.getItem(storageKey)) {
    return
  }
  Storage.setItem(storageKey, JSON.stringify(value))
}




const appInitialData = {
  // Cache for advice data. It is organized as a map of maps: the first key
  // being the project ID and the second one the advice ID.
  adviceData: {},
  // Cache for advice tips for each advice module for each project.
  adviceTips: {},
  // Authentication token.
  authToken: Storage.getItem(AUTH_TOKEN_COOKIE_NAME),
  // Default props to use when creating a new project.
  defaultProjectProps: {},
  // Default for props storing if user has seen Bob Sharing modal.
  hasSeenShareModal: false,
  initialFeatures: getJsonFromStorage(FEATURES_LOCAL_STORAGE_NAME),
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


function app(state = appInitialData, action) {
  switch (action.type) {
    case LOAD_LANDING_PAGE:
      return {
        ...state,
        defaultProjectProps: {
          ...state.defaultProjectProps,
          ...action.defaultProjectProps,
        },
      }
    case GET_EXPANDED_CARD_CONTENT:
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
    case OPEN_LOGIN_MODAL:
      return {...state, loginModal: {defaultValues: {
        isReturningUser: true,
        ...action.defaultValues,
      }}}
    case OPEN_REGISTER_MODAL:
      return {...state, loginModal: {defaultValues: action.defaultValues || {}}}
    case CLOSE_LOGIN_MODAL:
      if (action.hasCanceledLogin) {
        Storage.removeItem(AUTH_TOKEN_COOKIE_NAME)
      }
      return {
        ...state,
        authToken: action.hasCanceledLogin ? null : state.authToken,
        loginModal: null,
      }
    case GET_JOBS:
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
    case GET_PROJECT_REQUIREMENTS:
      if (action.status === 'success' && action.project) {
        return {
          ...state,
          jobRequirements: {
            ...state.jobRequirements,
            [action.project.targetJob.codeOgr]: action.response,
          },
        }
      }
      break
    case ACCEPT_COOKIES_USAGE:
      // 604800000 is the number of milliseconds in a week.
      Storage.setItem(ACCEPT_COOKIES_COOKIE_NAME, new Date().getTime() + 604800000)
      return {
        ...state,
        userHasAcceptedCookiesUsage: true,
      }
    case SWITCH_TO_MOBILE_VERSION:
      return {
        ...state,
        isMobileVersion: true,
      }
    case LOGOUT: // Fallthrough intended.
    case DELETE_USER_DATA:
      Storage.removeItem(AUTH_TOKEN_COOKIE_NAME)
      return {...state, adviceData: {}, adviceTips: {}, authToken: null}
    case GET_ADVICE_TIPS:
      if (action.status !== 'success' || !action.advice || !action.project) {
        return state
      }
      return {
        ...state,
        adviceTips: {
          ...state.adviceTips,
          [action.project.projectId]: {
            ...(state.adviceTips[action.project.projectId] || {}),
            [action.advice.adviceId]: action.response,
          },
        },
      }
    case MODIFY_PROJECT:
      return {
        ...state,
        adviceData: _omit(state.adviceData, action.project.projectId),
      }
    case TRACK_INITIAL_UTM:
      if (!state.initialUtm && action.utm) {
        setOnceJsonToStorage(UTM_LOCAL_STORAGE_NAME, action.utm)
      }
      return {
        ...state,
        initialUtm: state.initialUtm || action.utm,
      }
    case TRACK_INITIAL_FEATURES:
      if (!state.initialFeatures && action.features) {
        setOnceJsonToStorage(FEATURES_LOCAL_STORAGE_NAME, action.features)
      }
      return {
        ...state,
        initialFeatures: state.initialFeatures || action.features,
      }
    case AUTHENTICATE_USER:
      if (action.status !== 'success' || !action.response.authToken) {
        return state
      }
      Storage.setItem(AUTH_TOKEN_COOKIE_NAME, action.response.authToken)
      return {
        ...state,
        authToken: action.response.authToken,
        lastAccessAt: action.response.lastAccessAt,
      }
    case WILL_ACTIVATE_DEMO:
      return {
        ...state,
        demo: action.demo,
      }
    case ACTIVATE_DEMO:
      return _omit(state, ['demo'])
    case PRODUCT_UPDATED_PAGE_IS_SHOWN:
      return _omit(state, ['lastAccessAt'])
    case SHARE_PRODUCT_MODAL_IS_SHOWN:
      return {
        ...state,
        hasSeenShareModal: true,
      }
    case DIAGNOSE_ONBOARDING:
      if (action.status === 'success') {
        const {comments = []} = action.response
        // TODO(cyrille): first group by field, then split by isBeforeQuestion.
        return {
          ...state,
          quickDiagnostic: {
            after: {
              ...state.quickDiagnostic.after,
              ..._keyBy(comments.filter(({isBeforeQuestion}) => !isBeforeQuestion), 'field'),
            },
            before: {
              ...state.quickDiagnostic.before,
              ..._keyBy(comments.filter(({isBeforeQuestion}) => isBeforeQuestion), 'field'),
            },
          },
        }
      }
      return state
    case CHANGE_SUBMETRIC_EXPANSION:
      return {
        ...state,
        submetricsExpansion: {
          ...state.submetricsExpansion,
          [action.topic]: action.isExpanded,
        },
      }
    case TRIGGER_QUICK_DIAGNOSTIC:
      return {
        ...state,
        defaultProjectProps: {
          ...state.defaultProjectProps,
          ..._omit(action, ['type']),
        },
      }
  }
  return state
}

const asyncInitialData = {
  errorMessage: null,
  isFetching: {},
}

function asyncState(state = asyncInitialData, action) {
  if (action.type === HIDE_TOASTER_MESSAGE) {
    return {...state, errorMessage: null}
  }
  if (action.type === DISPLAY_TOAST_MESSAGE) {
    return {...state, errorMessage: action.error}
  }
  if (!action.ASYNC_MARKER) {
    return state
  }
  if (action.status === 'error') {
    return {
      ..._omit(state, ['authMethod']),
      errorMessage: (action.ignoreFailure || !action.error) ? '' : action.error.toString(),
      isFetching: {...state.isFetching, [action.type]: false},
    }
  }
  if (action.status === 'success') {
    return {
      ..._omit(state, ['authMethod']),
      errorMessage: null,
      isFetching: {...state.isFetching, [action.type]: false},
    }
  }
  return {
    ...state,
    authMethod: action.method || state.authMethod,
    isFetching: {...state.isFetching, [action.type]: true},
  }
}


export {app, asyncState}

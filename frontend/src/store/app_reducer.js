import _keyBy from 'lodash/keyBy'
import _omit from 'lodash/omit'
import Cookies from 'js-cookie'

import {AUTHENTICATE_USER, HIDE_TOASTER_MESSAGE, DISPLAY_TOAST_MESSAGE,
  GET_PROJECT_REQUIREMENTS, LOAD_LANDING_PAGE, TRACK_INITIAL_UTM,
  OPEN_LOGIN_MODAL, CLOSE_LOGIN_MODAL, GET_JOBS, ACCEPT_COOKIES_USAGE,
  SWITCH_TO_MOBILE_VERSION, LOGOUT, DELETE_USER_DATA, GET_ADVICE_TIPS,
  MODIFY_PROJECT, OPEN_REGISTER_MODAL, PRODUCT_UPDATED_PAGE_IS_SHOWN,
  GET_EXPANDED_CARD_CONTENT, ACTIVATE_DEMO, WILL_ACTIVATE_DEMO,
  SHARE_PRODUCT_MODAL_IS_SHOWN, GET_MAYDAY_HELPER_COUNT, DIAGNOSE_ONBOARDING} from './actions'

// Name of the cookie to accept cookies.
const ACCEPT_COOKIES_COOKIE_NAME = 'accept-cookies'
// Name of the cookie to store the auth token.
const AUTH_TOKEN_COOKIE_NAME = 'authToken'
// Name of the local storage key to store the UTM initial information.
const UTM_LOCAL_STORAGE_NAME = 'utm'


function getUtmFromStorage(storage) {
  if (!storage) {
    return null
  }
  const utmContent = storage.getItem(UTM_LOCAL_STORAGE_NAME)
  if (!utmContent) {
    return null
  }
  return JSON.parse(utmContent)
}


function setUtmToStorage(storage, utm) {
  if (!storage || storage.getItem(UTM_LOCAL_STORAGE_NAME)) {
    return
  }
  storage.setItem(UTM_LOCAL_STORAGE_NAME, JSON.stringify(utm))
}


const appInitialData = {
  // Cache for advice data. It is organized as a map of maps: the first key
  // being the project ID and the second one the advice ID.
  adviceData: {},
  // Cache for advice tips for each advice module for each project.
  adviceTips: {},
  // Authentication token.
  authToken: Cookies.get(AUTH_TOKEN_COOKIE_NAME),
  // Default props to use when creating a new project.
  defaultProjectProps: {},
  // Default for props storing if user has seen Bob Sharing modal.
  hasSeenShareModal: false,
  initialUtm: getUtmFromStorage(localStorage),
  isMobileVersion: false,
  // Cache of job requirements.
  jobRequirements: {},
  lastAccessAt: null,
  loginModal: null,
  maydayData: null,
  newProjectProps: {},
  quickDiagnostic: {
    after: {},
    before: {},
  },
  // Cache for specific jobs.
  specificJobs: {},
  userHasAcceptedCookiesUsage: Cookies.get(ACCEPT_COOKIES_COOKIE_NAME),
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
        Cookies.remove(AUTH_TOKEN_COOKIE_NAME)
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
    case GET_MAYDAY_HELPER_COUNT:
      if (action.status === 'success') {
        return {
          ...state,
          maydayData: {
            ...action.response,
            actionHelperCount: {
              ...action.response.actionHelperCount,
            },
            totalHelperCount: action.response.totalHelperCount || 0,
          },
        }
      }
      break
    case ACCEPT_COOKIES_USAGE:
      Cookies.set(ACCEPT_COOKIES_COOKIE_NAME, '1', {expires: 7})
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
      Cookies.remove(AUTH_TOKEN_COOKIE_NAME)
      return {...state, authToken: null}
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
        setUtmToStorage(localStorage, action.utm)
      }
      return {
        ...state,
        initialUtm: state.initialUtm || action.utm,
      }
    case AUTHENTICATE_USER:
      if (action.status !== 'success' || !action.response.authToken) {
        return state
      }
      Cookies.set(AUTH_TOKEN_COOKIE_NAME, action.response.authToken)
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

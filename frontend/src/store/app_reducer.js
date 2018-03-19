import omit from 'lodash/omit'
import Cookies from 'js-cookie'

import {AUTHENTICATE_USER, HIDE_TOASTER_MESSAGE, DISPLAY_TOAST_MESSAGE,
  GET_PROJECT_REQUIREMENTS, GET_DASHBOARD_EXPORT, LOAD_LANDING_PAGE, TRACK_INITIAL_UTM,
  OPEN_LOGIN_MODAL, CLOSE_LOGIN_MODAL, GET_JOBS, ACCEPT_COOKIES_USAGE,
  SWITCH_TO_MOBILE_VERSION, LOGOUT, DELETE_USER_DATA, GET_ADVICE_TIPS,
  MODIFY_PROJECT, OPEN_REGISTER_MODAL, PRODUCT_UPDATED_PAGE_IS_SHOWN,
  GET_EXPANDED_CARD_CONTENT, GET_USER_COUNT, ACTIVATE_DEMO, WILL_ACTIVATE_DEMO} from './actions'

// Name of the cookie to accept cookies.
const ACCEPT_COOKIES_COOKIE_NAME = 'accept-cookies'
// Name of the cookie to store the auth token.
const AUTH_TOKEN_COOKIE_NAME = 'authToken'


const appInitialData = {
  // Cache for advice data. It is organized as a map of maps: the first key
  // being the project ID and the second one the advice ID.
  adviceData: {},
  // Cache for advice tips for each advice module for each project.
  adviceTips: {},
  // Authentication token.
  authToken: Cookies.get(AUTH_TOKEN_COOKIE_NAME),
  // Cache for dashboard exports.
  dashboardExports: {},
  // Default props to use when creating a new project.
  defaultProjectProps: {},
  initialUtm: null,
  isMobileVersion: false,
  // Cache of job requirements.
  jobRequirements: {},
  lastAccessAt: null,
  loginModal: null,
  newProjectProps: {},
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
    case GET_DASHBOARD_EXPORT:
      if (action.status === 'success') {
        return {
          ...state,
          dashboardExports: {
            ...state.dashboardExports,
            [action.response.dashboardExportId]: action.response,
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
        adviceData: omit(state.adviceData, action.project.projectId),
      }
    case TRACK_INITIAL_UTM:
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
    case GET_USER_COUNT:
      if (action.status === 'success') {
        return {
          ...state,
          userCounts: action.response,
        }
      }
      break
    case WILL_ACTIVATE_DEMO:
      return {
        ...state,
        demo: action.demo,
      }
    case ACTIVATE_DEMO:
      return omit(state, ['demo'])
    case PRODUCT_UPDATED_PAGE_IS_SHOWN:
      return omit(state, ['lastAccessAt'])
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
      ...state,
      errorMessage: (action.ignoreFailure || !action.error) ? '' : action.error.toString(),
      isFetching: {...state.isFetching, [action.type]: false},
    }
  }
  if (action.status === 'success') {
    return {...state, errorMessage: null, isFetching: {...state.isFetching, [action.type]: false}}
  }
  return {...state, isFetching: {...state.isFetching, [action.type]: true}}
}


export {app, asyncState}

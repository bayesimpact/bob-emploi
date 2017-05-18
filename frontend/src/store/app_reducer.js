import Cookies from 'js-cookie'

import {HIDE_TOASTER_MESSAGE, DISPLAY_TOAST_MESSAGE, GET_PROJECT_REQUIREMENTS,
        GET_DASHBOARD_EXPORT, GET_JOB_BOARDS,
        OPEN_LOGIN_MODAL, CLOSE_LOGIN_MODAL, GET_JOBS,
        ACCEPT_COOKIES_USAGE, SWITCH_TO_MOBILE_VERSION,
        LOGOUT, DELETE_USER_DATA, GET_ADVICE_TIPS} from './actions'

// Name of the cookie to accept cookies.
const ACCEPT_COOKIES_COOKIE_NAME = 'accept-cookies'

const appInitialData = {
  // Cache for advice tips for each advice module for each project.
  adviceTips: {},
  // Cache for dashboard exports.
  dashboardExports: {},
  isMobileVersion: false,
  // Cache of job boards.
  jobBoards: {},
  // Cache of job requirements.
  jobRequirements: {},
  loginModal: null,
  newProjectProps: {},
  // Cache for specific jobs.
  specificJobs: {},
  userHasAcceptedCookiesUsage: Cookies.get(ACCEPT_COOKIES_COOKIE_NAME),
}

function app(state=appInitialData, action) {
  switch (action.type) {
    case OPEN_LOGIN_MODAL:
      return {...state, loginModal: {defaultValues: action.defaultValues || {}}}
    case CLOSE_LOGIN_MODAL:
      return {...state, loginModal: null}
    case GET_JOB_BOARDS:
      if (action.status === 'success' && action.project) {
        return {
          ...state,
          jobBoards: {
            ...state.jobBoards,
            [action.project.projectId]: action.response,
          },
        }
      }
      break
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
    case LOGOUT:  // Fallthrough intended.
    case DELETE_USER_DATA:
      return state
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
  }
  return state
}

const asyncInitialData = {
  errorMessage: null,
  isFetching: {},
}

function asyncState(state=asyncInitialData, action) {
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
      errorMessage: action.ignoreFailure ? '' : action.error.toString(),
      isFetching: {...state.isFetching, [action.type]: false},
    }
  }
  if(action.status === 'success') {
    return {...state, errorMessage: null, isFetching: {...state.isFetching, [action.type]: false}}
  }
  return {...state, isFetching: {...state.isFetching, [action.type]: true}}
}


export {app, asyncState}

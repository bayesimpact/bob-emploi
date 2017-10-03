import Cookies from 'js-cookie'
import _ from 'underscore'

import {AUTHENTICATE_USER, HIDE_TOASTER_MESSAGE, DISPLAY_TOAST_MESSAGE, GET_PROJECT_REQUIREMENTS,
  GET_DASHBOARD_EXPORT, GET_JOB_BOARDS, TRACK_INITIAL_UTM_CONTENT,
  OPEN_LOGIN_MODAL, CLOSE_LOGIN_MODAL, GET_JOBS, GET_ASSOCIATIONS,
  ACCEPT_COOKIES_USAGE, SWITCH_TO_MOBILE_VERSION, GET_VOLUNTEERING_MISSIONS,
  LOGOUT, DELETE_USER_DATA, GET_ADVICE_TIPS, MODIFY_PROJECT, GET_COMMUTING_CITIES,
  GET_RESUME_TIPS, GET_INTERVIEW_TIPS, OPEN_REGISTER_MODAL, GET_EVENTS,
  GET_EXPANDED_CARD_CONTENT} from './actions'

// Name of the cookie to accept cookies.
const ACCEPT_COOKIES_COOKIE_NAME = 'accept-cookies'


const appInitialData = {
  // Cache for advice data. It is organized as a map of maps: the first key
  // being the project ID and the second one the advice ID.
  adviceData: {},
  // Cache for advice tips for each advice module for each project.
  adviceTips: {},
  // Authentication token.
  authToken: Cookies.get('authToken'),
  // Cache for dashboard exports.
  dashboardExports: {},
  initialUtmContent: null,
  isMobileVersion: false,
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
    case GET_ASSOCIATIONS: // Fallthrough intended.
    case GET_COMMUTING_CITIES: // Fallthrough intended.
    case GET_EVENTS: // Fallthrough intended.
    case GET_JOB_BOARDS: // Fallthrough intended.
    case GET_INTERVIEW_TIPS: // Fallthrough intended.
    case GET_RESUME_TIPS: // Fallthrough intended.
    case GET_VOLUNTEERING_MISSIONS: // Fallthrough intended.
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
      return {...state, loginModal: null}
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
      Cookies.remove('authToken')
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
        adviceData: _.omit(state.adviceData, action.project.projectId),
      }
    case TRACK_INITIAL_UTM_CONTENT:
      return {
        ...state,
        initialUtmContent: state.initialUtmContent || action.utmContent,
      }
    case AUTHENTICATE_USER:
      if (action.status !== 'success' || !action.response.authToken) {
        return state
      }
      Cookies.set('authToken', action.response.authToken)
      return {
        ...state,
        authToken: action.response.authToken,
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
      errorMessage: (action.ignoreFailure || !action.error) ? '' : action.error.toString(),
      isFetching: {...state.isFetching, [action.type]: false},
    }
  }
  if(action.status === 'success') {
    return {...state, errorMessage: null, isFetching: {...state.isFetching, [action.type]: false}}
  }
  return {...state, isFetching: {...state.isFetching, [action.type]: true}}
}


export {app, asyncState}

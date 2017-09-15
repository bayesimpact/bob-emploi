import Cookies from 'js-cookie'
import _ from 'underscore'

import {AUTHENTICATE_USER, HIDE_TOASTER_MESSAGE, DISPLAY_TOAST_MESSAGE, GET_PROJECT_REQUIREMENTS,
  GET_DASHBOARD_EXPORT, GET_JOB_BOARDS, TRACK_INITIAL_UTM_CONTENT,
  OPEN_LOGIN_MODAL, CLOSE_LOGIN_MODAL, GET_JOBS, GET_ASSOCIATIONS,
  ACCEPT_COOKIES_USAGE, SWITCH_TO_MOBILE_VERSION, GET_VOLUNTEERING_MISSIONS,
  LOGOUT, DELETE_USER_DATA, GET_ADVICE_TIPS, MODIFY_PROJECT, GET_COMMUTING_CITIES,
  GET_RESUME_TIPS, GET_INTERVIEW_TIPS, OPEN_REGISTER_MODAL, GET_EVENTS} from './actions'

// Name of the cookie to accept cookies.
const ACCEPT_COOKIES_COOKIE_NAME = 'accept-cookies'


// Set of data cached for each project mapped to the action type that retrieves
// this info.
const cachedProjectData = {
  associations: GET_ASSOCIATIONS,
  commutingCities: GET_COMMUTING_CITIES,
  events: GET_EVENTS,
  interviewTips: GET_INTERVIEW_TIPS,
  jobBoards: GET_JOB_BOARDS,
  resumeTips: GET_RESUME_TIPS,
  volunteeringMissions: GET_VOLUNTEERING_MISSIONS,
}


const appInitialData = {
  // Cache for advice tips for each advice module for each project.
  adviceTips: {},
  // Authentication token.
  authToken: null,
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
_.forEach(cachedProjectData, (value, key) => {
  appInitialData[key] = {}
})


function cacheData(state, action, field) {
  if (action.status === 'success' && action.project) {
    return {
      ...state,
      [field]: {
        ...state[field],
        [action.project.projectId]: action.response,
      },
    }
  }
  return state
}


const typeReducers = {
  ..._.mapObject(_.invert(cachedProjectData), field => {
    return (state, action) => cacheData(state, action, field)
  }),
}


function app(state=appInitialData, action) {
  const reducer = typeReducers[action.type]
  if (reducer) {
    return reducer(state, action)
  }
  switch (action.type) {
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
    case MODIFY_PROJECT:
      return {
        ...state,
        ..._.mapObject(cachedProjectData, field => _.omit(state[field], action.project.projectId)),
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

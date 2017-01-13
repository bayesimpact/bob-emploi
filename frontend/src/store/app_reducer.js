import Cookies from 'js-cookie'

import {HIDE_TOASTER_MESSAGE, DISPLAY_TOAST_MESSAGE, CLOSE_NEW_PROJECT_MODAL, GET_DISCOVERY_DATA,
        OPEN_NEW_PROJECT_MODAL, GET_PROJECT_REQUIREMENTS, GET_POTENTIAL_CHANTIERS,
        UPDATE_PROJECT_CHANTIERS, GET_DASHBOARD_EXPORT, CREATE_DASHBOARD_EXPORT,
        OPEN_LOGIN_MODAL, CLOSE_LOGIN_MODAL, GET_CHANTIER_TITLES,
        ACCEPT_COOKIES_USAGE, SWITCH_TO_MOBILE_VERSION, REFRESH_USER_DATA,
        LOGOUT, DELETE_USER_DATA, CREATE_ACTION_PLAN, GET_DISCOVERY_JOB_GROUP_DATA} from './actions'

// Name of the cookie to accept cookies.
const ACCEPT_COOKIES_COOKIE_NAME = 'accept-cookies'

const appInitialData = {
  chantierTitles: {},
  // Cache for dashboard exports.
  dashboardExports: {},
  // Cache for discoveries keyed by "jobId:cityId".
  discoveries: {},
  isMobileVersion: false,
  isNewProjectModalOpen: false,
  // Cache for job group stats keyed by "romeId:cityId".
  jobGroupStats: {},
  // Cache of job requirements.
  jobRequirements: {},
  loginModal: null,
  newProjectProps: {},
  // Cache of potential chantiers per project.
  projectsPotentialChantiers: {},
  scheduledUserDataRefreshTimeout: null,
  userHasAcceptedCookiesUsage: Cookies.get(ACCEPT_COOKIES_COOKIE_NAME),
}

function app(state=appInitialData, action) {
  switch (action.type) {
    case OPEN_LOGIN_MODAL:
      return {...state, loginModal: {defaultValues: action.defaultValues || {}}}
    case CLOSE_LOGIN_MODAL:
      return {...state, loginModal: null}
    case OPEN_NEW_PROJECT_MODAL:
      return {...state, isNewProjectModalOpen: true, newProjectProps: action.props}
    case CLOSE_NEW_PROJECT_MODAL:
      return {...state, isNewProjectModalOpen: false}
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
    case GET_POTENTIAL_CHANTIERS:
      if (action.status === 'success' && action.projectId) {
        return {
          ...state,
          projectsPotentialChantiers: {
            ...state.projectsPotentialChantiers,
            [action.projectId]: action.response,
          },
        }
      }
      break
    case CREATE_ACTION_PLAN:  // Fallthrough intended.
    case UPDATE_PROJECT_CHANTIERS:
      if (action.ASYNC_MARKER && !action.status && action.chantierIds && action.projectId &&
          state.projectsPotentialChantiers[action.projectId] &&
          state.projectsPotentialChantiers[action.projectId].chantiers) {
        return {
          ...state,
          projectsPotentialChantiers: {
            ...state.projectsPotentialChantiers,
            [action.projectId]: {
              ...state.projectsPotentialChantiers[action.projectId],
              chantiers: state.projectsPotentialChantiers[action.projectId].chantiers.map(
                chantier => ({
                  ...chantier,
                  userHasStarted: !!action.chantierIds[chantier.template.chantierId],
                })),
            },
          },
        }
      }
      break
    case GET_DISCOVERY_DATA:
      if (action.status === 'success') {
        const {city, jobGroups, sourceJob} = action.response
        const jobGroupStats = {...state.jobGroupStats};
        // jobGroups is a list of job group stats: we store it both in the
        // discoveries map to have the exploration data and we also prepopulate
        // the jobGroupStats map with each individual stat per job group.
        (jobGroups || []).forEach(jobGroup => {
          jobGroups[jobGroup.romeId + ':' + city.cityId] = jobGroup
        })
        return {
          ...state,
          discoveries: {
            ...state.discoveries,
            [sourceJob.codeOgr + ':' + city.cityId]: jobGroups,
          },
          jobGroupStats,
        }
      }
      break
    case GET_DISCOVERY_JOB_GROUP_DATA:
      if (action.status === 'success') {
        const {jobGroup} = action.response
        return {
          ...state,
          jobGroupStats: {
            ...state.jobGroupStats,
            [jobGroup.romeId + ':' + action.city.cityId]: action.response,
          },
        }
      }
      break
    case GET_DASHBOARD_EXPORT: // Fallthrough intended.
    case CREATE_DASHBOARD_EXPORT:
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
    case GET_CHANTIER_TITLES:
      if (action.status === 'success') {
        return {
          ...state,
          chantierTitles: {
            ...state.chantierTitles,
            ...action.response.titles,
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
    case REFRESH_USER_DATA:
      if (!action.timeoutHandle) {
        return state
      }
      clearTimeout(state.scheduledUserDataRefreshTimeout)
      return {
        ...state,
        scheduledUserDataRefreshTimeout: action.timeoutHandle,
      }
    case LOGOUT:  // Fallthrough intended.
    case DELETE_USER_DATA:
      clearTimeout(state.scheduledUserDataRefreshTimeout)
      return {
        ...state,
        scheduledUserDataRefreshTimeout: null,
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

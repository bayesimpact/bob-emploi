import Storage from 'local-storage-fallback'
import _omit from 'lodash/omit'

import {POST_USER_DATA, SET_USER_PROFILE, GET_USER_DATA, AUTHENTICATE_USER,
  LOGOUT, ADVICE_PAGE_IS_SHOWN, CREATE_PROJECT, CREATE_PROJECT_SAVE, TRACK_INITIAL_FEATURES,
  DELETE_USER_DATA, MODIFY_PROJECT, ACTIVATE_DEMO, EXPLORE_ADVICE, TRACK_INITIAL_UTM,
  FINISH_PROFILE_SITUATION, ACCEPT_PRIVACY_NOTICE, EDIT_FIRST_PROJECT,
  FINISH_PROFILE_FRUSTRATIONS, SEND_PROJECT_FEEDBACK, MARK_CHANGELOG_AS_SEEN,
  FINISH_PROJECT_CRITERIA, FINISH_PROJECT_GOAL, FINISH_PROFILE_SETTINGS,
  FINISH_PROJECT_EXPERIENCE, MIGRATE_USER_TO_ADVISOR, DIAGNOSE_ONBOARDING,
  CLOSE_LOGIN_MODAL} from './actions'
import {increaseRevision, keepMostRecentRevision} from './user'

// All data for a user of the companion app, a job seeker.
// Keep in sync with User protobuf.
const initialData = {
  facebookId: null,
  googleId: null,
  manualExplorations: [],
  profile: {},
  projects: [],
  userId: null,
}

// Name of the cookie containing the user ID.
const USER_ID_COOKIE_NAME = 'userId'


function updateOneofFields(stateProject, project) {
  // Add here if we ever use other oneof fields.
  const {jobSearchHasNotStarted, jobSearchStartedAt} = project
  if (jobSearchStartedAt || jobSearchHasNotStarted) {
    return {
      ..._omit(stateProject, ['jobSearchHasNotStarted', 'jobSearchStartedAt']),
      ...project,
    }
  }
  return {...stateProject, ...project}
}


// Updates the given properties of a project.
function updateProject(state, project, isFromServer) {
  const updatedState = project ? {
    ...state,
    projects: (state.projects || [{}]).map(stateProject => {
      if (project.projectId && stateProject.projectId !== project.projectId) {
        return stateProject
      }
      return updateOneofFields(stateProject, project)
    }),
  } : state
  return isFromServer ? updatedState : increaseRevision(updatedState)
}

function updateAdvice(state, project, advice, isFromServer) {
  let projectModified = false
  const updatedState = {
    ...state,
    projects: (state.projects || []).map(stateProject => {
      if (stateProject.projectId !== project.projectId) {
        return stateProject
      }
      let adviceModified = false
      const updatedProjectState = {
        ...stateProject,
      }

      const advices = (stateProject.advices || []).map(stateAdvice => {
        if (stateAdvice.adviceId !== advice.adviceId) {
          return stateAdvice
        }
        adviceModified = true
        return {...stateAdvice, ...advice}
      })
      if (adviceModified) {
        updatedProjectState.advices = advices
      }

      if (!adviceModified) {
        return stateProject
      }
      projectModified = true
      return updatedProjectState
    }),
  }
  return projectModified ?
    isFromServer ? increaseRevision(updatedState) : updatedState
    : state
}

function userReducer(state = initialData, action) {
  const success = action.status === 'success'
  switch (action.type) {
    case ACCEPT_PRIVACY_NOTICE: // Fallthrough intended.
    case FINISH_PROFILE_FRUSTRATIONS: // Fallthrough intended.
    case FINISH_PROFILE_SETTINGS: // Fallthrough intended.
    case FINISH_PROFILE_SITUATION: // Fallthrough intended.
    case SET_USER_PROFILE:
      return increaseRevision({
        ...state,
        profile: {
          ...state.profile,
          ...action.userProfile,
        },
      })
    case CREATE_PROJECT_SAVE: // Fallthrough intended.
    case GET_USER_DATA: // Fallthrough intended.
    case MIGRATE_USER_TO_ADVISOR: // Fallthrough intended.
    case POST_USER_DATA:
      if (success) {
        action.response.userId && Storage.setItem(USER_ID_COOKIE_NAME, action.response.userId)
        return keepMostRecentRevision(state, action.response)
      }
      return state
    case AUTHENTICATE_USER: {
      if (!success) {
        return state
      }
      const user = action.response && action.response.authenticatedUser
      if (user) {
        Storage.setItem(USER_ID_COOKIE_NAME, user.userId)
        return user
      }
      return state
    }
    case DELETE_USER_DATA:
      if (success) {
        Storage.removeItem(USER_ID_COOKIE_NAME)
        return {profile: {}}
      }
      return state
    case LOGOUT:
      Storage.removeItem(USER_ID_COOKIE_NAME)
      return {
        profile: {
          email: state && state.profile && state.profile.email,
        },
      }
    case CLOSE_LOGIN_MODAL:
      if (!action.hasCanceledLogin) {
        return state
      }
      Storage.removeItem(USER_ID_COOKIE_NAME)
      return {
        ...state,
        userId: null,
      }
    case CREATE_PROJECT: {
      if (state.projects && state.projects.length && !state.projects[0].isIncomplete) {
        // Project already exists: we allow only one project for now.
        return state
      }
      const project = {
        ...action.project,
        isIncomplete: false,
        status: 'PROJECT_CURRENT',
      }
      return increaseRevision({
        ...state,
        projects: [project],
      })
    }
    case FINISH_PROJECT_CRITERIA: // Fallthrough intended.
    case FINISH_PROJECT_GOAL: // Fallthrough intended.
    case FINISH_PROJECT_EXPERIENCE: // Fallthrough intended.
    case EDIT_FIRST_PROJECT: {
      if (state.projects && state.projects.length && !state.projects[0].isIncomplete) {
        // Project already exists: we cannot edit it anymore.
        return state
      }
      const project = {
        ...action.project,
        isIncomplete: true,
      }
      return increaseRevision({
        ...state,
        projects: [project],
      })
    }
    case MODIFY_PROJECT:
      return updateProject(state, {
        advices: [],
        diagnostic: null,
        feedback: {},
        isIncomplete: true,
        localStats: {},
        projectId: action.project.projectId,
      })
    case ADVICE_PAGE_IS_SHOWN:
    case EXPLORE_ADVICE:
      if (!action.status) {
        // Before sending the update to the server, let's modify the client
        // state to make the change faster.
        return updateAdvice(state, action.project, {...action.advice, ...action.adviceDiff})
      } else if (success && action.result) {
        // Coming back from server: replace the advice by the result.
        return updateAdvice(state, action.project, action.result, true)
      }
      return state
    case SEND_PROJECT_FEEDBACK:
      if (!action.status) {
        // Before sending the update to the server, let's modify the client
        // state to make the change faster.
        return updateProject(state, {
          feedback: action.projectDiff.feedback,
          projectId: action.project.projectId,
        })
      } else if (success && action.result) {
        // Coming back from server: replace the project by the result.
        return updateProject(state, action.project, action.result, true)
      }
      return state
    case MARK_CHANGELOG_AS_SEEN:
      if (!state.latestChangelogSeen || action.changelog > state.latestChangelogSeen) {
        return increaseRevision({
          ...state,
          latestChangelogSeen: action.changelog,
        })
      }
      return state
    case ACTIVATE_DEMO:
      return {
        ...state,
        featuresEnabled: {
          ...state.featuresEnabled,
          [action.demo]: 'ACTIVE',
        },
      }
    case DIAGNOSE_ONBOARDING:
      if (action.status || !action.user) {
        return state
      }
      return updateProject({
        ...state,
        profile: {
          ...state.profile,
          ...action.user.profile,
        },
      }, action.user.projects && action.user.projects[0])
    case TRACK_INITIAL_UTM:
      return {
        ...state,
        origin: state.origin || action.utm,
      }
    case TRACK_INITIAL_FEATURES:
      return {
        ...state,
        featuresEnabled: state.featuresEnabled || action.features,
      }
    default:
      return state
  }
}


export {userReducer}

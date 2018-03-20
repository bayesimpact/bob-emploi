import {POST_USER_DATA, SET_USER_PROFILE, GET_USER_DATA, AUTHENTICATE_USER,
  LOGOUT, ADVICE_PAGE_IS_SHOWN, CREATE_PROJECT, CREATE_PROJECT_SAVE,
  DELETE_USER_DATA, MODIFY_PROJECT, ACTIVATE_DEMO,
  FINISH_PROFILE_SITUATION, ACCEPT_PRIVACY_NOTICE, EDIT_FIRST_PROJECT,
  FINISH_PROFILE_FRUSTRATIONS, SEND_PROJECT_FEEDBACK, MARK_CHANGELOG_AS_SEEN,
  FINISH_PROJECT_CRITERIA, FINISH_PROJECT_GOAL,
  FINISH_PROJECT_EXPERIENCE, MIGRATE_USER_TO_ADVISOR, SCORE_ADVICE,
  MARK_NOTIFICATION_AS_SEEN, CLOSE_LOGIN_MODAL} from './actions'
import {increaseRevision, keepMostRecentRevision} from './user'
import Cookies from 'js-cookie'

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


// Updates the given properties of a project.
function updateProject(state, project) {
  return increaseRevision({
    ...state,
    projects: (state.projects || []).map(stateProject => {
      if (stateProject.projectId === project.projectId) {
        return {
          ...stateProject,
          ...project,
        }
      }
      return stateProject
    }),
  })
}

function updateAdvice(state, project, advice) {
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
  return projectModified ? increaseRevision(updatedState) : state
}

function userReducer(state = initialData, action) {
  const success = action.status === 'success'
  switch (action.type) {
    case ACCEPT_PRIVACY_NOTICE: // Fallthrough intended.
    case FINISH_PROFILE_FRUSTRATIONS: // Fallthrough intended.
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
        action.response.userId && Cookies.set(USER_ID_COOKIE_NAME, action.response.userId)
        return keepMostRecentRevision(state, action.response)
      }
      return state
    case AUTHENTICATE_USER: {
      if (!success) {
        return state
      }
      const user = action.response && action.response.authenticatedUser
      if (user) {
        Cookies.set(USER_ID_COOKIE_NAME, user.userId)
        return user
      }
      return state
    }
    case DELETE_USER_DATA:
      if (success) {
        Cookies.remove(USER_ID_COOKIE_NAME)
        return {profile: {}}
      }
      return state
    case LOGOUT:
      Cookies.remove(USER_ID_COOKIE_NAME)
      return {
        profile: {
          email: state && state.profile && state.profile.email,
        },
      }
    case CLOSE_LOGIN_MODAL:
      if (!action.hasCanceledLogin) {
        return state
      }
      Cookies.remove(USER_ID_COOKIE_NAME)
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
        feedback: {},
        isIncomplete: true,
        localStats: {},
        projectId: action.project.projectId,
      })
    case ADVICE_PAGE_IS_SHOWN:
      return updateAdvice(state, action.project, {
        adviceId: action.advice.adviceId,
        status: 'ADVICE_READ',
      })
    case SCORE_ADVICE:
      return updateAdvice(state, action.project, {
        adviceId: action.advice.adviceId,
        score: action.score || 0,
      })
    case SEND_PROJECT_FEEDBACK:
      return updateProject(state, {
        feedback: action.feedback,
        projectId: action.project.projectId,
      })
    case MARK_CHANGELOG_AS_SEEN:
      if (!state.latestChangelogSeen || action.changelog > state.latestChangelogSeen) {
        return increaseRevision({
          ...state,
          latestChangelogSeen: action.changelog,
        })
      }
      return state
    case MARK_NOTIFICATION_AS_SEEN:
      if (!action.notification) {
        return state
      }
      return increaseRevision({
        ...state,
        notificationsSeen: {
          ...state.notificationsSeen,
          [action.notification]: true,
        },
      })
    case ACTIVATE_DEMO:
      return {
        ...state,
        featuresEnabled: {
          ...state.featuresEnabled,
          [action.demo]: 'ACTIVE',
        },
      }
    default:
      return state
  }
}


export {userReducer}

import PropTypes from 'prop-types'
import {POST_USER_DATA, SET_USER_PROFILE, GET_USER_DATA, AUTHENTICATE_USER,
        LOGOUT, ADVICE_PAGE_IS_SHOWN, CREATE_PROJECT, CREATE_PROJECT_SAVE,
        MOVE_USER_DATES_BACK_1_DAY, DELETE_USER_DATA,
        FINISH_PROFILE_SITUATION, ACCEPT_PRIVACY_NOTICE, EDIT_FIRST_PROJECT,
        FINISH_PROFILE_FRUSTRATIONS, DECLINE_WHOLE_ADVICE,
        FINISH_PROJECT_CRITERIA, FINISH_PROJECT_GOAL, LIKE_OR_DISLIKE_FEATURE,
        FINISH_PROJECT_EXPERIENCE, MIGRATE_USER_TO_ADVISOR} from './actions'
import {travelInTime} from './user'
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


const USER_PROFILE_SHAPE = PropTypes.shape({
  city: PropTypes.object,
  gender: PropTypes.string,
  name: PropTypes.string,
  pictureUrl: PropTypes.string,
  situation: PropTypes.string,
  yearOfBirth: PropTypes.number,
})


// Updates the given properties of a project.
function updateProject(state, project) {
  return {
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
  }
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
  return projectModified ? updatedState : state
}

function user(state=initialData, action) {
  const success = action.status === 'success'
  switch (action.type) {
    case ACCEPT_PRIVACY_NOTICE:  // Fallthrough intended.
    case FINISH_PROFILE_FRUSTRATIONS:  // Fallthrough intended.
    case FINISH_PROFILE_SITUATION:  // Fallthrough intended.
    case SET_USER_PROFILE:
      return {
        ...state,
        profile: {
          ...state.profile,
          ...action.userProfile,
        },
      }
    case CREATE_PROJECT_SAVE: // Fallthrough intended.
    case GET_USER_DATA:  // Fallthrough intended.
    case MIGRATE_USER_TO_ADVISOR:  // Fallthrough intended.
    case POST_USER_DATA:
      if (success) {
        action.response.userId && Cookies.set('userId', action.response.userId)
        return action.response
      }
      return state
    case AUTHENTICATE_USER: {
      if (!success) {
        return state
      }
      const user = action.response && action.response.authenticatedUser
      if (user) {
        Cookies.set('userId', user.userId)
        return user
      }
      return state
    }
    case DELETE_USER_DATA:
      if (success) {
        Cookies.remove('userId')
        return {profile: {}}
      }
      return state
    case LOGOUT:
      Cookies.remove('userId')
      return {
        profile: {
          email: state && state.profile && state.profile.email,
        },
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
      return {
        ...state,
        projects: [project],
      }
    }
    case FINISH_PROJECT_CRITERIA:  // Fallthrough intended.
    case FINISH_PROJECT_GOAL:  // Fallthrough intended.
    case FINISH_PROJECT_EXPERIENCE:  // Fallthrough intended.
    case EDIT_FIRST_PROJECT: {
      if (state.projects && state.projects.length && !state.projects[0].isIncomplete) {
        // Project already exists: we cannot edit it anymore.
        return state
      }
      const project = {
        ...action.project,
        isIncomplete: true,
      }
      return {
        ...state,
        projects: [project],
      }
    }
    case MOVE_USER_DATES_BACK_1_DAY:
      return travelInTime({...state}, -24 * 60 * 60 * 1000)
    case ADVICE_PAGE_IS_SHOWN:
      return updateAdvice(state, action.project, {
        adviceId: action.advice.adviceId,
        status: 'ADVICE_READ',
      })
    case DECLINE_WHOLE_ADVICE:
      return updateProject(state, {
        projectId: action.project.projectId,
        uselessAdviceFeedback: action.uselessAdviceFeedback || 'aucun commentaire',
      })
    case LIKE_OR_DISLIKE_FEATURE:
      return {
        ...state,
        likes: {
          ...(state.likes || {}),
          [action.feature]: action.likeScore,
        },
      }
    default:
      return state
  }
}


export {user, USER_PROFILE_SHAPE}

import React from 'react'
import {POST_USER_DATA, SET_USER_PROFILE, GET_USER_DATA, FINISH_ACTION,
        CANCEL_ACTION, AUTHENTICATE_USER, LOGOUT,
        CREATE_PROJECT, UPDATE_PROJECT_CHANTIERS, CREATE_PROJECT_SAVE,
        MOVE_USER_DATES_BACK_1_DAY, READ_ACTION, SET_PROJECT_PROPERTIES,
        DELETE_USER_DATA, SET_USER_INTERACTION, CREATE_ACTION_PLAN,
        REFRESH_ACTION_PLAN, STICK_ACTION, FINISH_PROFILE_SITUATION,
        FINISH_PROFILE_QUALIFICATIONS, ACCEPT_PRIVACY_NOTICE,
        FINISH_STICKY_ACTION_STEP, ADD_MANUAL_EXPLORATION, EDIT_FIRST_PROJECT,
        FINISH_PROFILE_FRUSTRATIONS,
        EDIT_MANUAL_EXPLORATION, DELETE_MANUAL_EXPLORATION, STOP_STICKY_ACTION,
        ACCEPT_ADVICE, DECLINE_ADVICE, CANCEL_ADVICE_ENGAGEMENT,
        FINISH_PROJECT_CRITERIA, FINISH_PROJECT_GOAL,
        FINISH_PROJECT_EXPERIENCE} from '../store/actions'
import {finishStickyActionStep} from './project'
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


const USER_PROFILE_SHAPE = React.PropTypes.shape({
  city: React.PropTypes.object,
  gender: React.PropTypes.string,
  name: React.PropTypes.string,
  pictureUrl: React.PropTypes.string,
  situation: React.PropTypes.string,
  yearOfBirth: React.PropTypes.number,
})


function updateAction(state, action) {
  // TODO(pascal): Fix this hack where we modify the action object.
  // eslint-disable-next-line no-unused-vars
  const {project, ...actionProps} = action
  const updateActions = actions => (actions || []).map(chantierAction => {
    if (chantierAction.actionId !== action.actionId) {
      return chantierAction
    }
    return actionProps
  })
  return {
    ...state,
    projects: (state.projects || []).map(project => {
      return {
        ...project,
        actions: updateActions(project.actions),
        pastActions: updateActions(project.pastActions),
      }
    }),
  }
}


// Updates the given properties of a project.
// TODO: Harmonize with `updateAction`, which sets the whole action instead of only
// overwriting the given attributes as this function does it.
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
    case FINISH_PROFILE_QUALIFICATIONS:  // Fallthrough intended.
    case FINISH_PROFILE_SITUATION:  // Fallthrough intended.
    case SET_USER_PROFILE:
      return {
        ...state,
        profile: {
          ...state.profile,
          ...action.userProfile,
        },
      }
    case SET_USER_INTERACTION:
      return {
        ...state,
        interactions: {
          ...state.interactions,
          [action.interaction]: true,
        },
      }
    case CREATE_PROJECT_SAVE: // Fallthrough intended.
    case GET_USER_DATA:  // Fallthrough intended.
    case POST_USER_DATA:  // Fallthrough intended.
    case REFRESH_ACTION_PLAN:
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
    case CREATE_ACTION_PLAN:  // Fallthrough intended.
    case UPDATE_PROJECT_CHANTIERS:
      if (success) {
        return action.response
      }
      return state
    case FINISH_ACTION: {
      const finishedAction = {
        ...action.action,
        doneFeedback: action.feedback.caption,
        status: 'ACTION_DONE',
        wasUseful: action.feedback.wasUseful ? 'USEFUL' : 'NOT_USEFUL',
      }
      return updateAction(state, finishedAction)
    }
    case READ_ACTION:
      if (action.action.status !== 'ACTION_UNREAD') {
        return state
      }
      return updateAction(state, {...action.action, status: 'ACTION_CURRENT'})
    case CANCEL_ACTION: {
      const canceledAction = {
        ...action.action,
        declineReason: action.feedback.caption,
        status: action.feedback.status || 'ACTION_DECLINED',
      }
      if (canceledAction.status === 'ACTION_DONE') {
        canceledAction.doneFeedback = canceledAction.declineReason
        delete canceledAction.declineReason
      }
      return updateAction(state, canceledAction)
    }
    case STICK_ACTION: {
      return {
        ...state,
        projects: (state.projects || []).map(project => {
          const isStuckAction = candidate => candidate.actionId === action.action.actionId
          const isNotStuckAction = candidate => !isStuckAction(candidate)
          const isInActions = (project.actions || []).some(isStuckAction)
          const isInPastActions = !isInActions && (project.pastActions || []).some(isStuckAction)
          if (!isInActions && !isInPastActions) {
            return project
          }
          return {
            ...project,
            actions: isInActions ? project.actions.filter(isNotStuckAction) : project.actions || [],
            pastActions: isInPastActions ?
              project.pastActions.filter(isNotStuckAction) : project.pastActions || [],
            stickyActions: (project.stickyActions || []).concat([{
              ...action.action,
              status: 'ACTION_STUCK',
            }]),
          }
        }),
      }
    }
    case FINISH_STICKY_ACTION_STEP:
      return {
        ...state,
        projects: (state.projects || []).map(project => {
          return finishStickyActionStep(project, action.step, action.text)
        }),
      }
    case STOP_STICKY_ACTION:
      // TODO(pascal): Store action.feedback (the reason why the user stopped
      // the sticky action).
      return {
        ...state,
        projects: (state.projects || []).map(project => {
          const isTargetedAction = stickyAction => stickyAction.actionId === action.action.actionId
          if (!(project.stickyActions || []).some(isTargetedAction)) {
            return project
          }
          return {
            ...project,
            // Here we modify manualy the past_actions field as a sticky action
            // can only get passed if the user decides it. Regular actions, are
            // moved to past_actions on the server when the action plan is
            // refreshed (daily).
            pastActions: (project.pastActions || []).concat([action.action]),
            stickyActions: (project.stickyActions || []).filter(
                stickyAction => stickyAction.actionId !== action.action.actionId),
          }
        }),
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
    case SET_PROJECT_PROPERTIES:
      return updateProject(state, {...action.projectProperties, projectId: action.projectId})
    case MOVE_USER_DATES_BACK_1_DAY:
      return travelInTime({...state}, -24 * 60 * 60 * 1000)
    case ADD_MANUAL_EXPLORATION:
      return {
        ...state,
        manualExplorations: [action.exploration].concat(state.manualExplorations || []),
      }
    case EDIT_MANUAL_EXPLORATION:
      return {
        ...state,
        manualExplorations: state.manualExplorations.slice(0, action.index).concat(
          [action.exploration], state.manualExplorations.slice(action.index + 1)),
      }
    case DELETE_MANUAL_EXPLORATION:
      return {
        ...state,
        manualExplorations: state.manualExplorations.slice(0, action.index).concat(
          state.manualExplorations.slice(action.index + 1)),
      }
    case ACCEPT_ADVICE:
      return updateAdvice(state, action.project, {
        adviceId: action.advice.adviceId,
        status: 'ADVICE_ACCEPTED',
      })
    case DECLINE_ADVICE:
      return updateAdvice(state, action.project, {
        adviceId: action.advice.adviceId,
        declinedReason: action.reason || '',
        status: 'ADVICE_DECLINED',
      })
    case CANCEL_ADVICE_ENGAGEMENT:
      return updateAdvice(state, action.project, {
        adviceId: action.advice.adviceId,
        status: 'ADVICE_CANCELED',
      })
    default:
      return state
  }
}


export {user, USER_PROFILE_SHAPE}

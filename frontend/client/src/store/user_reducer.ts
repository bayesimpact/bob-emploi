import Storage from 'local-storage-fallback'

import {AllActions} from './actions'
import {increaseRevision, keepMostRecentRevision} from './user'

// Name of the cookie containing the user ID.
const USER_ID_COOKIE_NAME = 'userId'


// All data for a user of the companion app, a job seeker.
// Keep in sync with User protobuf.
const initialData = {
  facebookId: undefined,
  googleId: undefined,
  manualExplorations: [],
  profile: {},
  projects: [],
  userId: Storage.getItem(USER_ID_COOKIE_NAME) || undefined,
}


function updateOneofFields(stateProject: bayes.bob.Project, project: bayes.bob.Project):
bayes.bob.Project {
  // Add here if we ever use other oneof fields.
  const {jobSearchHasNotStarted, jobSearchStartedAt} = project
  const {
    jobSearchHasNotStarted: omittedJobSearchHasNotStarted,
    jobSearchStartedAt: omittedJobSearchStartedAt,
    ...cleanedStateProject
  } = stateProject
  if (jobSearchStartedAt || jobSearchHasNotStarted) {
    return {
      ...cleanedStateProject,
      ...project,
    }
  }
  return {...stateProject, ...project}
}


// Updates the given properties of a project.
function updateProject(
  state: bayes.bob.User, project?: bayes.bob.Project, isFromServer?: boolean): bayes.bob.User {
  const updatedState = project ? {
    ...state,
    projects: (state.projects || [{}]).map((stateProject): bayes.bob.Project => {
      if (project.projectId && stateProject.projectId !== project.projectId) {
        return stateProject
      }
      return updateOneofFields(stateProject, project)
    }),
  } : state
  return isFromServer ? updatedState : increaseRevision(updatedState)
}

function updateAdvice(
  state: bayes.bob.User, project: bayes.bob.Project, advice: bayes.bob.Advice,
  isFromServer?: boolean): bayes.bob.User {
  let projectModified = false
  const updatedState = {
    ...state,
    projects: (state.projects || []).map((stateProject): bayes.bob.Project => {
      if (stateProject.projectId !== project.projectId) {
        return stateProject
      }
      let adviceModified = false
      const updatedProjectState = {
        ...stateProject,
      }

      const advices = (stateProject.advices || []).map((stateAdvice): bayes.bob.Advice => {
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


function updateStrategy(
  state: bayes.bob.User, project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy,
  isFromServer?: boolean): bayes.bob.User {
  let projectModified = false
  const updatedState = {
    ...state,
    projects: (state.projects || []).map((stateProject): bayes.bob.Project => {
      if (stateProject.projectId !== project.projectId) {
        return stateProject
      }
      let strategyModified = false
      const updatedProjectState = {
        ...stateProject,
      }

      const strategies = (stateProject.openedStrategies || []).
        map((stateStrategy): bayes.bob.WorkingStrategy => {
          if (stateStrategy.strategyId !== strategy.strategyId) {
            return stateStrategy
          }
          strategyModified = true
          return strategy
        })
      if (!strategyModified) {
        strategies.push(strategy)
      }
      projectModified = true
      updatedProjectState.openedStrategies = strategies
      return updatedProjectState
    }),
  }
  return projectModified ?
    isFromServer ? increaseRevision(updatedState) : updatedState
    : state
}


function userReducer(state: bayes.bob.User = initialData, action: AllActions): bayes.bob.User {
  switch (action.type) {
    case 'FINISH_PROFILE_FRUSTRATIONS': // Fallthrough intended.
    case 'FINISH_PROFILE_SETTINGS': // Fallthrough intended.
    case 'FINISH_PROFILE_SITUATION': // Fallthrough intended.
    case 'SET_USER_PROFILE':
      return increaseRevision({
        ...state,
        profile: {
          ...state.profile,
          ...action.userProfile,
        },
      })
    case 'CREATE_PROJECT_SAVE': // Fallthrough intended.
    case 'GET_USER_DATA': // Fallthrough intended.
    case 'MIGRATE_USER_TO_ADVISOR': // Fallthrough intended.
    case 'POST_USER_DATA':
      if (action.status === 'success') {
        action.response.userId && Storage.setItem(USER_ID_COOKIE_NAME, action.response.userId)
        return keepMostRecentRevision(state, action.response)
      }
      return state
    case 'AUTHENTICATE_USER': {
      if (action.status !== 'success') {
        return state
      }
      const user = action.response && action.response.authenticatedUser
      if (user) {
        if (user.userId) {
          Storage.setItem(USER_ID_COOKIE_NAME, user.userId)
        }
        return user
      }
      return state
    }
    case 'DELETE_USER_DATA':
      if (action.status === 'success') {
        Storage.removeItem(USER_ID_COOKIE_NAME)
        return {profile: {}}
      }
      return state
    case 'LOGOUT':
      Storage.removeItem(USER_ID_COOKIE_NAME)
      return {
        profile: {
          email: state && state.profile && state.profile.email,
        },
      }
    case 'REMOVE_AUTH_DATA':
      Storage.removeItem(USER_ID_COOKIE_NAME)
      return {
        ...state,
        userId: undefined,
      }
    case 'CREATE_PROJECT': {
      if (state.projects && state.projects.length && !state.projects[0].isIncomplete) {
        // Project already exists: we allow only one project for now.
        return state
      }
      const project: bayes.bob.Project = {
        ...action.project,
        isIncomplete: false,
        status: 'PROJECT_CURRENT',
      }
      return increaseRevision({
        ...state,
        profile: {
          ...state.profile,
          hasCompletedOnboarding: true,
        },
        projects: [project],
      })
    }
    case 'FINISH_PROJECT_CRITERIA': // Fallthrough intended.
    case 'FINISH_PROJECT_GOAL': // Fallthrough intended.
    case 'FINISH_PROJECT_EXPERIENCE': // Fallthrough intended.
    case 'EDIT_FIRST_PROJECT': {
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
    case 'MODIFY_PROJECT':
      return updateProject(state, {
        advices: [],
        diagnostic: undefined,
        feedback: {},
        isIncomplete: true,
        localStats: undefined,
        openedStrategies: [],
        projectId: action.project.projectId,
        strategies: [],
      })
    case 'ADVICE_PAGE_IS_SHOWN':
    case 'EXPLORE_ADVICE':
      if (!action.status) {
        // Before sending the update to the server, let's modify the client
        // state to make the change faster.
        return updateAdvice(state, action.project, {...action.advice, ...action.adviceDiff})
      } else if (action.status === 'success' && action.response) {
        // Coming back from server: replace the advice by the result.
        return updateAdvice(state, action.project, action.response, true)
      }
      return state
    case 'DIAGNOSTIC_IS_SHOWN':
      if (!action.status && action.projectDiff) {
        // Before sending the update to the server, let's modify the client
        // state to make the change faster.
        return updateProject(state, {...action.project, ...action.projectDiff})
      } else if (action.status === 'success' && action.response) {
        // Coming back from server: replace the advice by the result.
        return updateProject(state, action.response, true)
      }
      return state
    case 'SEND_PROJECT_FEEDBACK':
      if (!action.status) {
        // Before sending the update to the server, let's modify the client
        // state to make the change faster.
        return updateProject(state, {
          feedback: action.projectDiff.feedback,
          projectId: action.project.projectId,
        })
      } else if (action.status === 'success' && action.response) {
        // Coming back from server: replace the project by the result.
        return updateProject(state, action.response, true)
      }
      return state
    case 'MARK_CHANGELOG_AS_SEEN':
      if (!state.latestChangelogSeen || action.changelog > state.latestChangelogSeen) {
        return increaseRevision({
          ...state,
          latestChangelogSeen: action.changelog,
        })
      }
      return state
    case 'ACTIVATE_DEMO':
      return {
        ...state,
        featuresEnabled: {
          ...state.featuresEnabled,
          [action.demo]: 'ACTIVE',
        },
      }
    case 'DIAGNOSE_ONBOARDING': {
      if (action.status || !action.user) {
        return state
      }
      const project = action.user.projects && action.user.projects[0]
      return updateProject({
        ...state,
        profile: {
          ...state.profile,
          ...action.user.profile,
        },
      }, project)
    }
    case 'REPLACE_STRATEGY':
      if (!action.status) {
        // Before sending the update to the server, let's modify the client
        // state to make the change faster.
        const tempStartDate = new Date()
        tempStartDate.setMilliseconds(0)
        const tempStrategy = {
          // Set a temporary start date if none is set yet.
          startedAt: tempStartDate.toISOString(),
          ...action.strategy,
        }
        return updateStrategy(state, action.project, tempStrategy)
      } else if (action.status === 'success' && action.response) {
        // Coming back from server: replace the strategy by the result.
        return updateStrategy(state, action.project, action.response, true)
      }
      return state
    case 'STOP_STRATEGY':
      if (!action.status) {
        // Before sending the update to the server, let's modify the client state to make the
        // change faster.
        return updateProject(state, {
          ...action.project,
          openedStrategies: (action.project.openedStrategies || []).
            filter(({strategyId}): boolean => strategyId !== action.strategy.strategyId),
        })
      }
      return state
    case 'TRACK_INITIAL_UTM':
      return {
        ...state,
        origin: state.origin || action.utm,
      }
    case 'TRACK_INITIAL_FEATURES':
      return {
        ...state,
        featuresEnabled: state.featuresEnabled || action.features,
      }
    default:
      return state
  }
}


export {userReducer}

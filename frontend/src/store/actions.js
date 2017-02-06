import {browserHistory} from 'react-router'

import {api} from './api'
import {newProject} from 'store/project'
import {splitFullName} from 'store/auth'
import {Gender, Situation, JobSearchPhase} from 'api/user'
import {ProjectIntensity} from 'api/project'
import {Routes} from 'components/url'

const sha1 = require('sha1')

const ASYNC_MARKER = 'ASYNC_MARKER'

// User actions.

export const DELETE_USER_DATA = 'DELETE_USER_DATA'
export const POST_USER_DATA = 'POST_USER_DATA'
export const GET_USER_DATA = 'GET_USER_DATA'
export const AUTHENTICATE_USER = 'AUTHENTICATE_USER'
export const REGISTER_USER = 'REGISTER_USER'
export const EMAIL_CHECK = 'EMAIL_CHECK'
export const LOGOUT = 'LOGOUT'
export const SET_USER_PROFILE = 'SET_USER_PROFILE'
export const ACCEPT_PRIVACY_NOTICE = 'ACCEPT_PRIVACY_NOTICE'
export const FINISH_PROFILE_SITUATION = 'FINISH_PROFILE_SITUATION'
export const FINISH_PROFILE_QUALIFICATIONS = 'FINISH_PROFILE_QUALIFICATIONS'
export const FINISH_ACTION = 'FINISH_ACTION'
export const CANCEL_ACTION = 'CANCEL_ACTION'
export const READ_ACTION = 'READ_ACTION'
export const STICK_ACTION = 'STICK_ACTION'
export const CREATE_PROJECT = 'CREATE_PROJECT'
export const CREATE_PROJECT_SAVE = 'CREATE_PROJECT_SAVE'
export const SET_PROJECT_PROPERTIES = 'SET_PROJECT_PROPERTIES'
export const SET_USER_INTERACTION = 'SET_USER_INTERACTION'
export const CREATE_ACTION_PLAN = 'CREATE_ACTION_PLAN'
export const REFRESH_ACTION_PLAN = 'REFRESH_ACTION_PLAN'
export const UPDATE_PROJECT_CHANTIERS = 'UPDATE_PROJECT_CHANTIERS'
export const MOVE_USER_DATES_BACK_1_DAY = 'MOVE_USER_DATES_BACK_1_DAY'
export const CREATE_DASHBOARD_EXPORT = 'CREATE_DASHBOARD_EXPORT'
export const GET_DASHBOARD_EXPORT = 'GET_DASHBOARD_EXPORT'
export const FINISH_STICKY_ACTION_STEP = 'FINISH_STICKY_ACTION_STEP'
export const STOP_STICKY_ACTION = 'STOP_STICKY_ACTION'
export const ADD_MANUAL_EXPLORATION = 'ADD_MANUAL_EXPLORATION'
export const EDIT_MANUAL_EXPLORATION = 'EDIT_MANUAL_EXPLORATION'
export const DELETE_MANUAL_EXPLORATION = 'DELETE_MANUAL_EXPLORATION'
export const ACCEPT_ADVICE = 'ACCEPT_ADVICE'
export const DECLINE_ADVICE = 'DECLINE_ADVICE'
export const CANCEL_ADVICE_ENGAGEMENT = 'CANCEL_ADVICE_ENGAGEMENT'

// App actions.

export const CLOSE_LOGIN_MODAL = 'CLOSE_LOGIN_MODAL'
export const OPEN_LOGIN_MODAL = 'OPEN_LOGIN_MODAL'
export const GET_PROJECT_REQUIREMENTS = 'GET_PROJECT_REQUIREMENTS'
export const GET_POTENTIAL_CHANTIERS = 'GET_POTENTIAL_CHANTIERS'
export const GET_CHANTIER_TITLES = 'GET_CHANTIER_TITLES'
export const HIDE_TOASTER_MESSAGE = 'HIDE_TOASTER_MESSAGE'
export const DISPLAY_TOAST_MESSAGE = 'DISPLAY_TOAST_MESSAGE'
export const ACCEPT_COOKIES_USAGE = 'ACCEPT_COOKIES_USAGE'
export const SWITCH_TO_MOBILE_VERSION = 'SWITCH_TO_MOBILE_VERSION'
export const LOAD_LANDING_PAGE = 'LOAD_LANDING_PAGE'
export const REFRESH_USER_DATA = 'REFRESH_USER_DATA'
export const RESET_USER_PASSWORD = 'RESET_USER_PASSWORD'
export const OPEN_ACTION_EXTERNAL_LINK = 'OPEN_ACTION_EXTERNAL_LINK'
export const ADVICE_IS_SHOWN = 'ADVICE_IS_SHOWN'
export const ENGAGEMENT_ACTION_IS_SHOWN = 'ENGAGEMENT_ACTION_IS_SHOWN'

// Set of actions we want to log in the analytics
export const actionTypesToLog = {
  [ACCEPT_ADVICE]: 'Accept suggested advice',
  [ACCEPT_PRIVACY_NOTICE]: 'Accept privacy notice',
  [ADVICE_IS_SHOWN]: 'Advice suggested',
  [AUTHENTICATE_USER]: 'Log in',
  [CANCEL_ACTION]: 'Close action',
  [CANCEL_ADVICE_ENGAGEMENT]: 'Cancel advice engagement',
  [CREATE_ACTION_PLAN]: 'Create action plan',
  [CREATE_DASHBOARD_EXPORT]: 'Create dashbord export',
  [CREATE_PROJECT]: 'Create project',
  [CREATE_PROJECT_SAVE]: 'Save project',
  [DECLINE_ADVICE]: 'Decline suggested advice',
  [DELETE_USER_DATA]: 'Delete user',
  [DISPLAY_TOAST_MESSAGE]: 'Display toast message',
  [ENGAGEMENT_ACTION_IS_SHOWN]: 'Advice engagement action shown',
  [FINISH_ACTION]: 'Close action',
  [FINISH_PROFILE_QUALIFICATIONS]: 'Finish profile qualifications',
  [FINISH_PROFILE_SITUATION]: 'Finish profile situation',
  [FINISH_STICKY_ACTION_STEP]: 'Finish sticky action step',
  [GET_DASHBOARD_EXPORT]: 'View dashbord export',
  [GET_USER_DATA]: 'Load app',
  [LOAD_LANDING_PAGE]: 'Load landing page',
  [LOGOUT]: 'Log out',
  [MOVE_USER_DATES_BACK_1_DAY]: 'Time travel!',
  [OPEN_ACTION_EXTERNAL_LINK]: 'Open action external link',
  [READ_ACTION]: 'Open new action',
  [REFRESH_ACTION_PLAN]: 'New actions shown',
  [REFRESH_USER_DATA]: 'User data refreshed',
  [REGISTER_USER]: 'Register new user',
  [RESET_USER_PASSWORD]: 'Ask password email',
  [SET_USER_PROFILE]: 'Update profile',
  [STICK_ACTION]: 'Close action',
  [STOP_STICKY_ACTION]: 'Stop sticky action',
  [UPDATE_PROJECT_CHANTIERS]: 'Update chantiers selection',
}

// Actions and action generators follow the following conventions:
// - action themselves are static objects, their names end by `Action`.
// - action generators:
//     - must take at least one parameter
//     - may not have a name ending by `Action'.
//     - always return a Promise or a thunk even when not asynchronous.
// Thanks to this conventions, callers of such actions may always rely on
// actions being plain actions, and action generated to always being resolved
// to a promise when dispatched even if the action is synchronous.
// `dispatch(doSomething(aboutThat)).then(...)`

// Plain actions, keep them grouped and alpha sorted.

const acceptCookiesUsageAction = {type: ACCEPT_COOKIES_USAGE}
const closeLoginModalAction = {type: CLOSE_LOGIN_MODAL}
const hideToasterMessageAction = {type: HIDE_TOASTER_MESSAGE}
const logoutAction = {type: LOGOUT}
const loadLandingPageAction = {type: LOAD_LANDING_PAGE}
const switchToMobileVersionAction = {type: SWITCH_TO_MOBILE_VERSION}

// Synchronous action generators, keep them grouped and alpha sorted.

function advisorRecommendationIsShown(project, advice) {
  return dispatch => dispatch({advice, project, type: ADVICE_IS_SHOWN})
}

function advisorEngagementActionIsShown(project, advice) {
  return dispatch => dispatch({advice, project, type: ENGAGEMENT_ACTION_IS_SHOWN})
}

function displayToasterMessage(error) {
  return dispatch => dispatch({error, type: DISPLAY_TOAST_MESSAGE})
}

function openActionExternalLink(action) {
  return dispatch => dispatch({action, type: OPEN_ACTION_EXTERNAL_LINK})
}

function openLoginModal(defaultValues) {
  return {defaultValues, type: OPEN_LOGIN_MODAL}
}

// Asynchronous action generators.

// Wrap an async function by dispatching an action before and after the
// function: the initial action has the given type and an ASYNC_MARKER, the
// final action has the same type and marker but also a status 'success' or
// 'error' with additional response or error var. The asyncFunc doesn't take
// any parameter and should return a promise.
function wrapAsyncAction(actionType, asyncFunc, options) {
  return (dispatch) => {
    const action = {...options, ASYNC_MARKER, type: actionType}
    dispatch(action)
    const promise = asyncFunc()
    promise.then(
      result => dispatch({...action, response: result, status: 'success'}),
      error => dispatch({...action, error: error, status: 'error'}),
    )
    return promise
  }
}

// Asynchronous actions wrapped with the dispatched actions (see wrapAsyncAction).

function createDashboardExport() {
  return (dispatch, getState) => {
    const {user} = getState()
    return dispatch(wrapAsyncAction(
      CREATE_DASHBOARD_EXPORT, () => api.createDashboardExportPost(user.userId)))
  }
}

function getDashboardExport(dashboardExportId) {
  return wrapAsyncAction(GET_DASHBOARD_EXPORT, () => api.dashboardExportGet(dashboardExportId))
}

// TODO: Get rid of the project for this action, it only needs a job. Also update the endpoint.
function fetchProjectRequirements(project) {
  return wrapAsyncAction(
    GET_PROJECT_REQUIREMENTS,
    () => api.projectRequirementsGet(project),
    {project},
  )
}

function fetchPotentialChantiers(projectId) {
  return (dispatch, getState) => {
    const {user} = getState()
    return dispatch(wrapAsyncAction(
      GET_POTENTIAL_CHANTIERS,
      () => api.projectPotentialChantiersGet(user.userId, projectId),
      {projectId}))
  }
}

function updateProjectChantiers(projectId, chantierIds, actionType) {
  return (dispatch, getState) => {
    const {user} = getState()
    dispatch(wrapAsyncAction(
      actionType || UPDATE_PROJECT_CHANTIERS,
      () => api.projectUpdateChantiersPost(user.userId, projectId, chantierIds),
      {chantierIds, projectId},
    ))
  }
}
const createActionPlan = (projectId, chantierIds) =>
  updateProjectChantiers(projectId, chantierIds, CREATE_ACTION_PLAN)

function deleteUser(userId) {
  return wrapAsyncAction(DELETE_USER_DATA, () => api.userDelete(userId))
}

function planRefreshActionPlan(refreshActionPlan) {
  return (dispatch, getState) => {
    const action = {ASYNC_MARKER, type: REFRESH_USER_DATA}
    // TODO(pascal): Update the duration of the timeout to refresh at ~4
    // o'clock in the morning. For now we refresh every hour.
    const timeoutHandle = setTimeout(() => {
      dispatch({...action, status: 'success'})
      const {user} = getState()
      if (user && user.userId) {
        dispatch(refreshActionPlan())
      }
    }, 3600000)
    return dispatch({...action, timeoutHandle})
  }
}

function refreshActionPlan() {
  return (dispatch, getState) => {
    const {user} = getState()
    dispatch(
        wrapAsyncAction(REFRESH_ACTION_PLAN, () => api.refreshActionPlanPost(user.userId))).
        then(response => {
          dispatch(planRefreshActionPlan(refreshActionPlan))
          return response
        })
  }
}

// TODO(pascal): Stop requiring userId and get it from state instead.
function fetchUser(userId, ignoreFailure) {
  return dispatch => {
    return dispatch(
        wrapAsyncAction(GET_USER_DATA, () => api.userGet(userId), {ignoreFailure})).
        then(response => {
          dispatch(planRefreshActionPlan(refreshActionPlan))
          return response
        })
  }
}

function saveUser(user) {
  return dispatch => {
    return dispatch(wrapAsyncAction(POST_USER_DATA, () => api.userPost(user))).
      then(response => {
        if (response.appNotAvailable) {
          browserHistory.push(Routes.APP_NOT_AVAILABLE_PAGE)
          dispatch(logoutAction)
        }
        return response
      })
  }
}

const _FACEBOOK_GENDER_MAPPING = {
  'female': 'FEMININE',
  'male': 'MASCULINE',
}

function facebookAuthenticateUser(facebookAuth, mockApi) {
  // The facebookAuth object contains:
  //  - the email address: email
  //  - the facebook user ID: userID
  //  - the full name: name
  //  - the URL of a profile picture: picture.data.url
  //  - the user's gender: gender
  //  - the user's birth day: birthday
  return wrapAsyncAction(AUTHENTICATE_USER, () => (mockApi || api).userAuthenticate({
    facebookSignedRequest: facebookAuth.signedRequest,
  }).then(authResponse => {
    // The signed request sent to the server only contains the facebook ID. If
    // it is verified we trust the full facebookAuth object and add non-signed
    // fields that we need.
    if (!authResponse || !authResponse.authenticatedUser ||
        facebookAuth.id !== authResponse.authenticatedUser.facebookId) {
      return authResponse
    }
    const userProfile = authResponse.authenticatedUser.profile || {}
    var yearOfBirth = userProfile.yearOfBirth
    if (!yearOfBirth && facebookAuth.birthday) {
      // Three formats are possible: MM/DD/YYYY, YYYY or MM/DD. The regexp
      // below removes the optional leading MM/DD/.
      const birthday = ~~parseInt(facebookAuth.birthday.replace(/^\d\d\/\d\d\/?/, ''), 10)
      if (birthday) {
        userProfile.yearOfBirth = birthday
      }
    }
    if (!userProfile.name && facebookAuth.name) {
      const {lastName, name} = splitFullName(facebookAuth.name)
      userProfile.lastName = lastName
      userProfile.name = name
    }
    if (facebookAuth.picture && facebookAuth.picture.data && facebookAuth.picture.data.url) {
      userProfile.pictureUrl = facebookAuth.picture.data.url
    }
    if (facebookAuth.gender &&  _FACEBOOK_GENDER_MAPPING[facebookAuth.gender]) {
      userProfile.gender = _FACEBOOK_GENDER_MAPPING[facebookAuth.gender]
    }
    if (facebookAuth.email) {
      userProfile.email = facebookAuth.email
    }
    return {
      ...authResponse,
      authenticatedUser: {
        ...authResponse.authenticatedUser,
        profile: userProfile,
      },
    }
  }))
}

function googleAuthenticateUser(googleAuth) {
  return wrapAsyncAction(AUTHENTICATE_USER, () => api.userAuthenticate({
    googleTokenId: googleAuth.getAuthResponse().id_token,
  }).then(authResponse => {
    // The signed request sent to the server only contains some fields. If it
    // is verified we trust the full googleAuth object and add non-signed
    // fields that we need.
    const profile = googleAuth.getBasicProfile()
    if (!authResponse || !authResponse.authenticatedUser ||
        profile.getId() !== authResponse.authenticatedUser.googleId) {
      return authResponse
    }
    return {
      ...authResponse,
      authenticatedUser: {
        ...authResponse.authenticatedUser,
        profile: {
          ...authResponse.authenticatedUser.profile,
          lastName: authResponse.authenticatedUser.profile.lastName || profile.getFamilyName(),
          name: authResponse.authenticatedUser.profile.name || profile.getGivenName(),
        },
      },
    }
  }))
}

function emailCheck(email) {
  return wrapAsyncAction(EMAIL_CHECK, () => api.userAuthenticate({email}))
}

function registerNewUser(email, password, firstName, lastName) {
  return dispatch => {
    return dispatch(wrapAsyncAction(AUTHENTICATE_USER, () => api.userAuthenticate({
      email,
      firstName,
      hashedPassword: sha1(email + password),
      lastName,
    }))).
    then(response => {
      dispatch(planRefreshActionPlan(refreshActionPlan))
      return response
    })
  }
}

function loginUser(email, password, hashSalt) {
  return dispatch => {
    return dispatch(wrapAsyncAction(
        AUTHENTICATE_USER, () => api.userAuthenticate({
          email, hashSalt, hashedPassword: sha1(hashSalt + sha1(email + password))}))).
        then(response => {
          dispatch(planRefreshActionPlan(refreshActionPlan))
          return response
        })
  }
}

function resetPassword(email, password, authToken) {
  return wrapAsyncAction(AUTHENTICATE_USER, () => api.userAuthenticate({
    authToken, email, hashedPassword: sha1(email + password)}))
}

function setUserProfile(userProfile, shouldAlsoSaveUser, type) {
  return (dispatch, getState) => {
    // Drop unknown kinds.
    if (userProfile.gender && !Gender[userProfile.gender]) {
      dispatch(displayToasterMessage('Unknown gender: ' + userProfile.gender))
      delete userProfile.gender
    }
    if (userProfile.situation && !Situation[userProfile.situation]) {
      dispatch(displayToasterMessage('Unknown situation: ' + userProfile.situation))
      delete userProfile.situation
    }
    if (userProfile.jobSearchPhase && !JobSearchPhase[userProfile.jobSearchPhase]) {
      dispatch(displayToasterMessage('Unknown job search phase: ' + userProfile.jobSearchPhase))
      delete userProfile.jobSearchPhase
    }
    dispatch({type: type || SET_USER_PROFILE, userProfile})
    if (shouldAlsoSaveUser) {
      return dispatch(saveUser(getState().user))
    }
  }
}

function setUserInteraction(interaction) {
  // TODO: Raise an error for unknown interactions.
  return (dispatch, getState) => {
    dispatch({interaction, type: SET_USER_INTERACTION})
    return dispatch(saveUser(getState().user))
  }
}

function finishAction(action, feedback) {
  return (dispatch, getState) => {
    dispatch({action, feedback, type: FINISH_ACTION})
    return dispatch(saveUser(getState().user)).then(() => {
      if (feedback.wasUseful) {
        dispatch(displayToasterMessage(
            'Génial, notre algorithme continuera de vous proposer des actions dans cette lignée.'))
      } else {
        dispatch(displayToasterMessage(
            "Désolé, notre algorithme vous proposera moins d'actions comme celle-là " +
            'dans le futur.'))
      }
    })
  }
}

function cancelAction(action, feedback) {
  return (dispatch, getState) => {
    dispatch({action, feedback, type: CANCEL_ACTION})
    return dispatch(saveUser(getState().user)).then(() => {
      if (feedback.status === 'ACTION_DECLINED') {
        dispatch(displayToasterMessage(
            "Compris, notre algorithme vous proposera moins d'actions comme celle-là " +
            'dans le futur.'))
      } else if (feedback.status === 'ACTION_SNOOZED') {
        dispatch(displayToasterMessage(
          'Très bien, cette action vous sera proposée un autre jour !'))
      }
    })
  }
}

function stickAction(action) {
  return (dispatch, getState) => {
    dispatch({action, type: STICK_ACTION})
    return dispatch(saveUser(getState().user))
  }
}

function finishStickyActionStep(step, text) {
  return (dispatch, getState) => {
    dispatch({step, text, type: FINISH_STICKY_ACTION_STEP})
    return dispatch(saveUser(getState().user))
  }
}

function stopStickyAction(action, feedback) {
  return (dispatch, getState) => {
    dispatch({action, feedback, type: STOP_STICKY_ACTION})
    return dispatch(saveUser(getState().user))
  }
}

function stopAdviceEngagement(project, advice, feedback) {
  return (dispatch, getState) => {
    dispatch({advice, feedback, project, type: CANCEL_ADVICE_ENGAGEMENT})
    return dispatch(saveUser(getState().user))
  }
}

function acceptAdvice(project, advice) {
  return (dispatch, getState) => {
    dispatch({advice, project, type: ACCEPT_ADVICE})
    return dispatch(saveUser(getState().user))
  }
}

function declineAdvice(project, reason, advice) {
  return (dispatch, getState) => {
    dispatch({advice, project, reason, type: DECLINE_ADVICE})
    return dispatch(saveUser(getState().user))
  }
}

function readAction(action, feedback) {
  return (dispatch, getState) => {
    dispatch({action, feedback, type: READ_ACTION})
    return dispatch(saveUser(getState().user))
  }
}

function createNewProject(newProjectData, options) {
  return (dispatch, getState) => {
    const {user} = getState()
    const project = newProject(newProjectData, user.profile && user.profile.gender)
    dispatch({options, project, type: CREATE_PROJECT})
    // Don't use normal saveUser to be able to distinguish between project creation and user saving.
    return dispatch(wrapAsyncAction(CREATE_PROJECT_SAVE, () => api.userPost(getState().user)))
  }
}

function setProjectProperty(projectId, projectProperties, shouldAlsoSaveProject) {
  return (dispatch, getState) => {
    // Drop unknown kinds.
    if (projectProperties.intensity && !ProjectIntensity[projectProperties.intensity]) {
      dispatch(displayToasterMessage('Unknown intensity: ' + projectProperties.intensity))
      delete projectProperties.intensity
    }
    dispatch({projectId, projectProperties, type: SET_PROJECT_PROPERTIES})
    if (shouldAlsoSaveProject) {
      return dispatch(saveUser(getState().user))
    }
  }

}

function moveUserDatesBackOneDay() {
  return (dispatch, getState) => {
    dispatch({type: MOVE_USER_DATES_BACK_1_DAY})
    return dispatch(saveUser(getState().user))
  }
}

function addManualExploration(sourceJob) {
  return (dispatch, getState) => {
    dispatch({
      exploration: {city: getState().user.profile.city, sourceJob},
      type: ADD_MANUAL_EXPLORATION},
    )
    return dispatch(saveUser(getState().user))
  }
}

function deleteManualExploration(index) {
  return (dispatch, getState) => {
    dispatch({index, type: DELETE_MANUAL_EXPLORATION})
    return dispatch(saveUser(getState().user))
  }
}

function editManualExploration(index, exploration) {
  return (dispatch, getState) => {
    dispatch({exploration, index, type: EDIT_MANUAL_EXPLORATION})
    return dispatch(saveUser(getState().user))
  }
}

// TODO(pascal): Remove this if we do not use it.
function getChantierTitles() {
  return wrapAsyncAction(GET_CHANTIER_TITLES, api.chantiersGet)
}

function askPasswordReset(email) {
  return wrapAsyncAction(RESET_USER_PASSWORD, () => api.resetPasswordPost(email))
}

export {saveUser, hideToasterMessageAction, setUserProfile, fetchUser,
        finishAction, cancelAction, readAction, facebookAuthenticateUser,
        googleAuthenticateUser, emailCheck, registerNewUser, loginUser, logoutAction,
        createNewProject, fetchProjectRequirements, resetPassword, fetchPotentialChantiers,
        updateProjectChantiers, moveUserDatesBackOneDay,
        createDashboardExport, getDashboardExport, displayToasterMessage,
        setProjectProperty, closeLoginModalAction, openLoginModal,
        getChantierTitles, acceptCookiesUsageAction, switchToMobileVersionAction,
        loadLandingPageAction, deleteUser, askPasswordReset,
        setUserInteraction, createActionPlan, refreshActionPlan,
        openActionExternalLink, stickAction, finishStickyActionStep,
        addManualExploration, editManualExploration, deleteManualExploration,
        stopStickyAction, acceptAdvice, declineAdvice,
        advisorRecommendationIsShown, stopAdviceEngagement, advisorEngagementActionIsShown,
}

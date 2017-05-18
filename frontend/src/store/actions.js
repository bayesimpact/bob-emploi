import {browserHistory} from 'react-router'
import sha1 from 'sha1'

import config from 'config'
import {api} from './api'
import {newProject} from 'store/project'
import {splitFullName} from 'store/auth'
import {Gender, Situation, JobSearchPhase} from 'api/user'
import {Routes} from 'components/url'

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
export const FINISH_PROFILE_FRUSTRATIONS = 'FINISH_PROFILE_FRUSTRATIONS'
export const READ_TIP = 'READ_TIP'
export const CREATE_PROJECT = 'CREATE_PROJECT'
export const CREATE_PROJECT_SAVE = 'CREATE_PROJECT_SAVE'
export const EDIT_FIRST_PROJECT = 'EDIT_FIRST_PROJECT'
export const FINISH_PROJECT_GOAL = 'FINISH_PROJECT_GOAL'
export const FINISH_PROJECT_CRITERIA = 'FINISH_PROJECT_CRITERIA'
export const FINISH_PROJECT_EXPERIENCE = 'FINISH_PROJECT_EXPERIENCE'
export const MOVE_USER_DATES_BACK_1_DAY = 'MOVE_USER_DATES_BACK_1_DAY'
export const GET_DASHBOARD_EXPORT = 'GET_DASHBOARD_EXPORT'
export const SELECT_ADVICE = 'SELECT_ADVICE'
export const DECLINE_WHOLE_ADVICE = 'DECLINE_WHOLE_ADVICE'
export const LIKE_OR_DISLIKE_FEATURE = 'LIKE_OR_DISLIKE_FEATURE'
export const MIGRATE_USER_TO_ADVISOR = 'MIGRATE_USER_TO_ADVISOR'

// App actions.

export const CLOSE_LOGIN_MODAL = 'CLOSE_LOGIN_MODAL'
export const OPEN_LOGIN_MODAL = 'OPEN_LOGIN_MODAL'
export const GET_PROJECT_REQUIREMENTS = 'GET_PROJECT_REQUIREMENTS'
export const HIDE_TOASTER_MESSAGE = 'HIDE_TOASTER_MESSAGE'
export const DISPLAY_TOAST_MESSAGE = 'DISPLAY_TOAST_MESSAGE'
export const ACCEPT_COOKIES_USAGE = 'ACCEPT_COOKIES_USAGE'
export const SWITCH_TO_MOBILE_VERSION = 'SWITCH_TO_MOBILE_VERSION'
export const LOAD_LANDING_PAGE = 'LOAD_LANDING_PAGE'
export const RESET_USER_PASSWORD = 'RESET_USER_PASSWORD'
export const OPEN_TIP_EXTERNAL_LINK = 'OPEN_TIP_EXTERNAL_LINK'
export const ADVICE_CARD_IS_SHOWN = 'ADVICE_CARD_IS_SHOWN'
export const ADVICE_PAGE_IS_SHOWN = 'ADVICE_PAGE_IS_SHOWN'
export const SAVE_LIKES = 'SAVE_LIKES'
export const GET_ADVICE_TIPS = 'GET_ADVICE_TIPS'
export const SEE_ADVICE = 'SEE_ADVICE'
export const SHOW_ALL_TIPS = 'SHOW_ALL_TIPS'
export const GET_JOB_BOARDS = 'GET_JOB_BOARDS'
export const GET_JOBS = 'GET_JOBS'
export const SEND_ADVICE_FEEDBACK = 'SEND_ADVICE_FEEDBACK'
export const SEND_PROFESSIONAL_FEEDBACK = 'SEND_PROFESSIONAL_FEEDBACK'
export const ALL_ADVICES_READ = 'ALL_ADVICES_READ'
export const SHARE_PRODUCT_TO_NETWORK = 'SHARE_PRODUCT_TO_NETWORK'

// Set of actions we want to log in the analytics
export const actionTypesToLog = {
  [ACCEPT_PRIVACY_NOTICE]: 'Accept privacy notice',
  [ADVICE_CARD_IS_SHOWN]: 'Advice card is shown',
  [ADVICE_PAGE_IS_SHOWN]: 'Advice page shown',
  [ALL_ADVICES_READ]: 'All advice cards have been read',
  [AUTHENTICATE_USER]: 'Log in',
  [CREATE_PROJECT]: 'Create project',
  [CREATE_PROJECT_SAVE]: 'Save project',
  [DECLINE_WHOLE_ADVICE]: 'Report the whole advice as useless',
  [DELETE_USER_DATA]: 'Delete user',
  [DISPLAY_TOAST_MESSAGE]: 'Display toast message',
  [FINISH_PROFILE_FRUSTRATIONS]: 'Finish profile frustrations',
  [FINISH_PROFILE_SITUATION]: 'Finish profile situation',
  [FINISH_PROJECT_CRITERIA]: 'Finish project criteria',
  [FINISH_PROJECT_EXPERIENCE]: 'Finish project experience',
  [FINISH_PROJECT_GOAL]: 'Finish project goal',
  [GET_DASHBOARD_EXPORT]: 'View dashbord export',
  [GET_USER_DATA]: 'Load app',
  [LIKE_OR_DISLIKE_FEATURE]: 'Like/Dislike feature',
  [LOAD_LANDING_PAGE]: 'Load landing page',
  [LOGOUT]: 'Log out',
  [MIGRATE_USER_TO_ADVISOR]: 'Migrate to advisor',
  [MOVE_USER_DATES_BACK_1_DAY]: 'Time travel!',
  [OPEN_LOGIN_MODAL]: 'Open login modal',
  [OPEN_TIP_EXTERNAL_LINK]: 'Open tip external link',
  [READ_TIP]: 'Open tip',
  [REGISTER_USER]: 'Register new user',
  [RESET_USER_PASSWORD]: 'Ask password email',
  [SEE_ADVICE]: 'See advice in dashboard',
  [SELECT_ADVICE]: 'Select advice',
  [SEND_ADVICE_FEEDBACK]: 'Send advice feedback',
  [SEND_PROFESSIONAL_FEEDBACK]: 'Send feedback from professional page',
  [SET_USER_PROFILE]: 'Update profile',
  [SHARE_PRODUCT_TO_NETWORK]: 'Share product to network',
  [SHOW_ALL_TIPS]: 'Show all tips',
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
const allAdvicesReadAction = {type: ALL_ADVICES_READ}
const closeLoginModalAction = {type: CLOSE_LOGIN_MODAL}
const hideToasterMessageAction = {type: HIDE_TOASTER_MESSAGE}
const logoutAction = {type: LOGOUT}
const loadLandingPageAction = {type: LOAD_LANDING_PAGE}
const switchToMobileVersionAction = {type: SWITCH_TO_MOBILE_VERSION}

// Synchronous action generators, keep them grouped and alpha sorted.

function adviceCardIsShown(project, advice) {
  return dispatch => dispatch({advice, project, type: ADVICE_CARD_IS_SHOWN})
}

function displayToasterMessage(error) {
  return dispatch => dispatch({error, type: DISPLAY_TOAST_MESSAGE})
}

function openLoginModal(defaultValues, visualElement) {
  return {defaultValues, type: OPEN_LOGIN_MODAL, visualElement}
}

function openTipExternalLink(action) {
  return dispatch => dispatch({action, type: OPEN_TIP_EXTERNAL_LINK})
}

function readTip(action, feedback) {
  return dispatch => dispatch({action, feedback, type: READ_TIP})
}

function selectAdvice(project, advice, visualElement) {
  return dispatch => {
    dispatch({advice, project, type: SELECT_ADVICE, visualElement})
  }
}

function seeAdvice(project, advice) {
  return dispatch => dispatch({advice, project, type: SEE_ADVICE})
}

function shareProductToNetwork(medium) {
  return dispatch => dispatch({medium, type: SHARE_PRODUCT_TO_NETWORK})
}

function showAllTips(project, advice) {
  return dispatch => dispatch({advice, project, type: SHOW_ALL_TIPS})
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

function getAdviceTips(project, advice) {
  return (dispatch, getState) => {
    const {user} = getState()
    return dispatch(wrapAsyncAction(
      GET_ADVICE_TIPS, () => api.adviceTipsGet(user, project, advice), {advice, project}))
  }
}

function getDashboardExport(dashboardExportId) {
  return wrapAsyncAction(GET_DASHBOARD_EXPORT, () => api.dashboardExportGet(dashboardExportId))
}

function getJobBoards(project) {
  return (dispatch, getState) => {
    const {user} = getState()
    return dispatch(wrapAsyncAction(
      GET_JOB_BOARDS, () => api.jobBoardsGet(user, project), {project}))
  }
}

function getJobs({romeId}) {
  return dispatch => {
    return dispatch(wrapAsyncAction(GET_JOBS, () => api.jobsGet(romeId), {romeId}))
  }
}

// TODO: Get rid of the project for this action, it only needs a job. Also update the endpoint.
function fetchProjectRequirements(project) {
  return wrapAsyncAction(
    GET_PROJECT_REQUIREMENTS,
    () => api.projectRequirementsGet(project),
    {project},
  )
}

function deleteUser(userId) {
  return wrapAsyncAction(DELETE_USER_DATA, () => api.userDelete(userId))
}

function fetchUser(userId, ignoreFailure) {
  return dispatch => {
    return dispatch(
        wrapAsyncAction(GET_USER_DATA, () => api.markUsedAndRetrievePost(userId), {ignoreFailure}))
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

function advicePageIsShown(project, advice) {
  return (dispatch, getState) => {
    dispatch({advice, project, type: ADVICE_PAGE_IS_SHOWN})
    return dispatch(saveUser(getState().user))
  }
}

function sendAdviceFeedback(project, advice, feedback) {
  return (dispatch, getState) => {
    dispatch(wrapAsyncAction(
      SEND_ADVICE_FEEDBACK,
      () => api.feedbackPost({
        adviceId: advice.adviceId,
        feedback,
        projectId: project.projectId,
        source: 'ADVICE_FEEDBACK',
        userId: getState().user.userId,
      }),
      {advice, feedback, project},
    )).then(() => dispatch(displayToasterMessage(
      "Merci ! Cela nous permettra d'améliorer nos conseils")))
  }
}

function sendProfessionalFeedback(feedback) {
  return (dispatch, getState) => {
    dispatch(wrapAsyncAction(
      SEND_PROFESSIONAL_FEEDBACK,
      () => api.feedbackPost({
        feedback,
        source: 'PROFESSIONAL_PAGE_FEEDBACK',
        userId: getState().user.userId,
      }),
      {feedback},
    )).then(() => dispatch(displayToasterMessage('Merci pour ce retour')))
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
    })))
  }
}

function likeOrDislikeFeature(feature, likeScore) {
  return (dispatch, getState) => {
    dispatch({feature, likeScore, type: LIKE_OR_DISLIKE_FEATURE})
    const {userId} = getState().user
    dispatch(wrapAsyncAction(SAVE_LIKES, () => api.saveLikes(userId, {[feature]: likeScore})))
  }
}

function loginUser(email, password, hashSalt) {
  return dispatch => {
    return dispatch(wrapAsyncAction(
        AUTHENTICATE_USER, () => api.userAuthenticate({
          email, hashSalt, hashedPassword: sha1(hashSalt + sha1(email + password))})))
  }
}

function migrateUserToAdvisor() {
  return (dispatch, getState) => {
    return dispatch(wrapAsyncAction(
      MIGRATE_USER_TO_ADVISOR, () => api.migrateUserToAdvisor(getState().user)))
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
    return Promise.resolve()
  }
}

// TODO(pascal): Rename to get rid of "whole" term that confuses some of us.
function declineWholeAdvice(project, uselessAdviceFeedback) {
  return (dispatch, getState) => {
    dispatch({project, type: DECLINE_WHOLE_ADVICE, uselessAdviceFeedback})
    return dispatch(saveUser(getState().user)).then(() => {
      if (uselessAdviceFeedback) {
        dispatch(displayToasterMessage(
          'Merci pour votre retour ! ' +
          'Nous allons travailler sur ces améliorations.'))
      } else {
        dispatch(displayToasterMessage(
          `Désolés, nous allons continuer à améliorer ${config.productName} ` +
          'pour mieux vous aider.'))
      }
    })
  }
}

function editFirstProject(newProjectData, actionType) {
  return (dispatch, getState) => {
    const {user} = getState()
    const project = newProject(newProjectData, user.profile && user.profile.gender)
    dispatch({project, type: actionType || EDIT_FIRST_PROJECT})
    return dispatch(saveUser(getState().user))
  }
}

function createFirstProject() {
  return (dispatch, getState) => {
    const {projects} = getState().user
    const project = projects && projects[0] || {}
    dispatch({project, type: CREATE_PROJECT})
    // Don't use normal saveUser to be able to distinguish between project creation and user saving.
    return dispatch(wrapAsyncAction(CREATE_PROJECT_SAVE, () => api.userPost(getState().user)))
  }
}

function moveUserDatesBackOneDay() {
  return (dispatch, getState) => {
    dispatch({type: MOVE_USER_DATES_BACK_1_DAY})
    return dispatch(saveUser(getState().user)).then(() => {
      dispatch(displayToasterMessage('Debug: Time Travel!'))
    })
  }
}

function askPasswordReset(email) {
  return wrapAsyncAction(RESET_USER_PASSWORD, () => api.resetPasswordPost(email))
}

export {saveUser, hideToasterMessageAction, setUserProfile, fetchUser,
        readTip, facebookAuthenticateUser, sendAdviceFeedback,
        googleAuthenticateUser, emailCheck, registerNewUser, loginUser, logoutAction,
        createFirstProject, fetchProjectRequirements, resetPassword,
        moveUserDatesBackOneDay, editFirstProject, sendProfessionalFeedback,
        getDashboardExport, displayToasterMessage, closeLoginModalAction,
        openLoginModal, acceptCookiesUsageAction, switchToMobileVersionAction,
        loadLandingPageAction, deleteUser, askPasswordReset, selectAdvice,
        openTipExternalLink, declineWholeAdvice, advicePageIsShown, seeAdvice,
        adviceCardIsShown, likeOrDislikeFeature, getAdviceTips,
        showAllTips, migrateUserToAdvisor, getJobBoards, getJobs,
        allAdvicesReadAction, shareProductToNetwork,
}

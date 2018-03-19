import {push} from 'react-router-redux'
import sha1 from 'sha1'

import {adviceTipsGet, dashboardExportGet, evalUseCasePoolsGet, evalUseCasesGet,
  jobRequirementsGet, jobsGet, userDelete, markUsedAndRetrievePost,
  userPost, feedbackPost, userAuthenticate, resetPasswordPost,
  migrateUserToAdvisorPost, projectComputeAdvicesPost, expandedCardContentGet,
  projectDiagnosePost, userCountGet} from './api'
import {splitFullName} from 'store/auth'
import {newProject} from 'store/project'
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
export const GET_DASHBOARD_EXPORT = 'GET_DASHBOARD_EXPORT'
export const SELECT_ADVICE = 'SELECT_ADVICE'
export const MIGRATE_USER_TO_ADVISOR = 'MIGRATE_USER_TO_ADVISOR'
export const MODIFY_PROJECT = 'MODIFY_PROJECT'
export const SCORE_ADVICE = 'SCORE_ADVICE'
export const MARK_CHANGELOG_AS_SEEN = 'MARK_CHANGELOG_AS_SEEN'
export const MARK_NOTIFICATION_AS_SEEN = 'MARK_NOTIFICATION_AS_SEEN'

// App actions.

export const ACTIVATE_DEMO = 'ACTIVATE_DEMO'
export const CLOSE_LOGIN_MODAL = 'CLOSE_LOGIN_MODAL'
export const OPEN_LOGIN_MODAL = 'OPEN_LOGIN_MODAL'
export const OPEN_REGISTER_MODAL = 'OPEN_REGISTER_MODAL'
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
export const GET_ADVICE_TIPS = 'GET_ADVICE_TIPS'
export const SEE_ADVICE = 'SEE_ADVICE'
export const SHOW_ALL_TIPS = 'SHOW_ALL_TIPS'
export const GET_JOBS = 'GET_JOBS'
export const SEND_ADVICE_FEEDBACK = 'SEND_ADVICE_FEEDBACK'
export const SEND_CHANGELOG_FEEDBACK = 'SEND_CHANGELOG_FEEDBACK'
export const SEND_PROFESSIONAL_FEEDBACK = 'SEND_PROFESSIONAL_FEEDBACK'
export const SEND_PROJECT_FEEDBACK = 'SEND_PROJECT_FEEDBACK'
export const SHARE_PRODUCT_MODAL_IS_SHOWN = 'SHARE_PRODUCT_MODAL_IS_SHOWN'
export const SHARE_PRODUCT_TO_NETWORK = 'SHARE_PRODUCT_TO_NETWORK'
export const TRACK_INITIAL_UTM = 'TRACK_INITIAL_UTM'
export const DIAGNOSTIC_IS_SHOWN = 'DIAGNOSTIC_IS_SHOWN'
export const EXPLORER_IS_SHOWN = 'EXPLORER_IS_SHOWN'
export const SEND_NEW_ADVICE_IDEA = 'SEND_NEW_ADVICE_IDEA'
export const COMPUTE_ADVICES_FOR_PROJECT = ' COMPUTE_ADVICES_FOR_PROJECT'
export const DIAGNOSE_PROJECT = 'DIAGNOSE_PROJECT'
export const GET_EVAL_USE_CASE_POOLS = 'GET_EVAL_USE_CASE_POOLS'
export const GET_EVAL_USE_CASES = 'GET_EVAL_USE_CASES'
export const GET_EXPANDED_CARD_CONTENT = 'GET_EXPANDED_CARD_CONTENT'
export const GET_USER_COUNT = 'GET_USER_COUNT'
export const DOWNLOAD_DIAGNOSTIC_PDF = 'DOWNLOAD_DIAGNOSTIC_PDF'
export const WILL_ACTIVATE_DEMO = 'WILL_ACTIVATE_DEMO'
export const PRODUCT_UPDATED_PAGE_IS_SHOWN = 'PRODUCT_UPDATED_PAGE_IS_SHOWN'

// Logging only.
const LANDING_PAGE_SECTION_IS_SHOWN = 'LANDING_PAGE_SECTION_IS_SHOWN'

// Set of actions we want to log in the analytics
export const actionTypesToLog = {
  [ACCEPT_PRIVACY_NOTICE]: 'Accept privacy notice',
  [ADVICE_CARD_IS_SHOWN]: 'Advice card is shown',
  [ADVICE_PAGE_IS_SHOWN]: 'Advice page shown',
  [AUTHENTICATE_USER]: 'Log in',
  [CREATE_PROJECT]: 'Create project',
  [CREATE_PROJECT_SAVE]: 'Save project',
  [DELETE_USER_DATA]: 'Delete user',
  [DIAGNOSTIC_IS_SHOWN]: 'Diagnostic is shown',
  [DISPLAY_TOAST_MESSAGE]: 'Display toast message',
  [DOWNLOAD_DIAGNOSTIC_PDF]: 'Download the diagnostic as a PDF',
  [EXPLORER_IS_SHOWN]: 'Explorer is shown',
  [FINISH_PROFILE_FRUSTRATIONS]: 'Finish profile frustrations',
  [FINISH_PROFILE_SITUATION]: 'Finish profile situation',
  [FINISH_PROJECT_CRITERIA]: 'Finish project criteria',
  [FINISH_PROJECT_EXPERIENCE]: 'Finish project experience',
  [FINISH_PROJECT_GOAL]: 'Finish project goal',
  [GET_DASHBOARD_EXPORT]: 'View dashbord export',
  [GET_USER_DATA]: 'Load app',
  [LANDING_PAGE_SECTION_IS_SHOWN]: 'A landing page section is shown',
  [LOAD_LANDING_PAGE]: 'Load landing page',
  [LOGOUT]: 'Log out',
  [MARK_CHANGELOG_AS_SEEN]: 'Mark Changelog as seen',
  [MARK_NOTIFICATION_AS_SEEN]: 'Mark notification as seen',
  [MIGRATE_USER_TO_ADVISOR]: 'Migrate to advisor',
  [MODIFY_PROJECT]: 'Modify project',
  [OPEN_LOGIN_MODAL]: 'Open login modal',
  [OPEN_REGISTER_MODAL]: 'Open register modal',
  [OPEN_TIP_EXTERNAL_LINK]: 'Open tip external link',
  [PRODUCT_UPDATED_PAGE_IS_SHOWN]: 'Product has been updated page shown',
  [READ_TIP]: 'Open tip',
  [REGISTER_USER]: 'Register new user',
  [RESET_USER_PASSWORD]: 'Ask password email',
  [SCORE_ADVICE]: 'Star/Unstar an advice card',
  [SEE_ADVICE]: 'See advice in dashboard',
  [SELECT_ADVICE]: 'Select advice',
  [SEND_ADVICE_FEEDBACK]: 'Send advice feedback',
  [SEND_CHANGELOG_FEEDBACK]: 'Send feedback from the changelog modal',
  [SEND_NEW_ADVICE_IDEA]: 'Send a new advice idea',
  [SEND_PROFESSIONAL_FEEDBACK]: 'Send feedback from professional page',
  [SEND_PROJECT_FEEDBACK]: 'Send project feedback',
  [SET_USER_PROFILE]: 'Update profile',
  [SHARE_PRODUCT_MODAL_IS_SHOWN]: 'Share product modal is shown',
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
const hideToasterMessageAction = {type: HIDE_TOASTER_MESSAGE}
const logoutAction = {type: LOGOUT}
const productUpdatedPageIsShownAction = {type: PRODUCT_UPDATED_PAGE_IS_SHOWN}
const switchToMobileVersionAction = {type: SWITCH_TO_MOBILE_VERSION}

// Synchronous action generators, keep them grouped and alpha sorted.

function activateDemoInFuture(demo) {
  return dispatch => dispatch({demo, type: WILL_ACTIVATE_DEMO})
}

function adviceCardIsShown(project, advice) {
  return dispatch => dispatch({advice, project, type: ADVICE_CARD_IS_SHOWN})
}

function closeLoginModal(hasCanceledLogin) {
  return {hasCanceledLogin, type: CLOSE_LOGIN_MODAL}
}

function diagnosticIsShown(project) {
  return dispatch => dispatch({project, type: DIAGNOSTIC_IS_SHOWN})
}

function displayToasterMessage(error) {
  return dispatch => dispatch({error, type: DISPLAY_TOAST_MESSAGE})
}

function downloadDiagnosticAsPdf(project) {
  return dispatch => dispatch({project, type: DOWNLOAD_DIAGNOSTIC_PDF})
}

function explorerIsShown(project) {
  return dispatch => dispatch({project, type: EXPLORER_IS_SHOWN})
}

function landingPageSectionIsShown(sectionName) {
  return dispatch => dispatch({type: LANDING_PAGE_SECTION_IS_SHOWN, visualElement: sectionName})
}

function openLoginModal(defaultValues, visualElement) {
  return {defaultValues, type: OPEN_LOGIN_MODAL, visualElement}
}

function openRegistrationModal(defaultValues, visualElement) {
  return {defaultValues, type: OPEN_REGISTER_MODAL, visualElement}
}

function openTipExternalLink(action) {
  return dispatch => dispatch({action, type: OPEN_TIP_EXTERNAL_LINK})
}

function loadLandingPage(timeToFirstInteractiveMillisecs, landingPageKind, specificJob) {
  return dispatch => dispatch({
    defaultProjectProps: specificJob ? {targetJob: specificJob} : {},
    landingPageKind,
    timeToFirstInteractiveMillisecs,
    type: LOAD_LANDING_PAGE,
  })
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

function shareProductModalIsShown(visualElement) {
  return dispatch => dispatch({type: SHARE_PRODUCT_MODAL_IS_SHOWN, visualElement})
}

function shareProductToNetwork(visualElement) {
  return dispatch => dispatch({type: SHARE_PRODUCT_TO_NETWORK, visualElement})
}

function showAllTips(project, advice) {
  return dispatch => dispatch({advice, project, type: SHOW_ALL_TIPS})
}

function trackInitialUtm(utm) {
  return dispatch => dispatch({type: TRACK_INITIAL_UTM, utm})
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

function computeAdvicesForProject(user) {
  return wrapAsyncAction(COMPUTE_ADVICES_FOR_PROJECT, () => projectComputeAdvicesPost(user))
}

function diagnoseProject(user) {
  return wrapAsyncAction(DIAGNOSE_PROJECT, () => projectDiagnosePost(user))
}

function getAdviceTips(project, advice) {
  return (dispatch, getState) => {
    const {user, app} = getState()
    return dispatch(wrapAsyncAction(
      GET_ADVICE_TIPS, () => adviceTipsGet(user, project, advice, app.authToken),
      {advice, project}))
  }
}

function getDashboardExport(dashboardExportId) {
  return wrapAsyncAction(GET_DASHBOARD_EXPORT, () => dashboardExportGet(dashboardExportId))
}

function getExpandedCardContent(project, adviceId) {
  return (dispatch, getState) => {
    const {user, app} = getState()
    return dispatch(
      wrapAsyncAction(
        GET_EXPANDED_CARD_CONTENT,
        () => expandedCardContentGet(user, project, {adviceId}, app.authToken),
        {advice: {adviceId}, project}))
  }
}

function getJobs({romeId}) {
  return dispatch => {
    return dispatch(wrapAsyncAction(GET_JOBS, () => jobsGet(romeId), {romeId}))
  }
}

function fetchProjectRequirements(project) {
  return wrapAsyncAction(
    GET_PROJECT_REQUIREMENTS,
    () => jobRequirementsGet(project.targetJob.jobGroup.romeId),
    {project},
  )
}

function deleteUser(userId) {
  return (dispatch, getState) => {
    const {app} = getState()
    return dispatch(wrapAsyncAction(DELETE_USER_DATA, () => userDelete(userId, app.authToken)))
  }
}

function fetchUser(userId, ignoreFailure) {
  return (dispatch, getState) => {
    const {authToken} = getState().app
    return dispatch(
      wrapAsyncAction(
        GET_USER_DATA,
        () => markUsedAndRetrievePost(userId, authToken),
        {ignoreFailure}))
  }
}

function saveUser(user) {
  return (dispatch, getState) => {
    const {authToken, initialUtm} = getState().app
    const trackedUser = user.origin ? user : {
      ...user,
      origin: initialUtm || undefined,
    }
    return dispatch(wrapAsyncAction(POST_USER_DATA, () => userPost(trackedUser, authToken))).
      then(response => {
        if (response.appNotAvailable) {
          dispatch(logoutAction)
          push(Routes.APP_NOT_AVAILABLE_PAGE)
        }
        return response
      })
  }
}

function activateDemo(demo) {
  return (dispatch, getState) => {
    dispatch({demo, type: ACTIVATE_DEMO})
    return dispatch(saveUser(getState().user))
  }
}

function advicePageIsShown(project, advice) {
  return (dispatch, getState) => {
    dispatch({advice, project, type: ADVICE_PAGE_IS_SHOWN})
    return dispatch(saveUser(getState().user))
  }
}

function sendFeedback(type, source, feedback, extraFields) {
  return (dispatch, getState) => {
    const {user, app} = getState()
    dispatch(wrapAsyncAction(
      type,
      () => feedbackPost({
        feedback,
        source,
        userId: user.userId,
        ...extraFields,
      }, app.authToken),
      {feedback},
    )).then(() => dispatch(displayToasterMessage('Merci pour ce retour')))
  }
}

function sendAdviceFeedback(project, advice, feedback) {
  return sendFeedback(SEND_ADVICE_FEEDBACK, 'ADVICE_FEEDBACK', feedback, {
    adviceId: advice.adviceId,
    projectId: project.projectId,
  })
}

function sendNewAdviceIdea({projectId}, feedback) {
  return sendFeedback(SEND_NEW_ADVICE_IDEA, 'NEW_ADVICE_FEEDBACK', feedback, {
    projectId,
  })
}

function sendProfessionalFeedback(feedback) {
  return sendFeedback(SEND_PROFESSIONAL_FEEDBACK, 'PROFESSIONAL_PAGE_FEEDBACK', feedback)
}

function sendProjectFeedback(project, feedback) {
  return (dispatch, getState) => {
    dispatch({feedback, project, type: SEND_PROJECT_FEEDBACK})
    return dispatch(saveUser(getState().user)).
      then(() => dispatch(displayToasterMessage('Merci pour ce retour !')))
  }
}

function sendChangelogFeedback(feedback) {
  return sendFeedback(SEND_CHANGELOG_FEEDBACK, 'CHANGELOG_FEEDBACK', feedback)
}

const _FACEBOOK_GENDER_MAPPING = {
  'female': 'FEMININE',
  'male': 'MASCULINE',
}

function facebookAuthenticateUser(facebookAuth, mockApi) {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  // The facebookAuth object contains:
  //  - the email address: email
  //  - the facebook user ID: userID
  //  - the full name: name
  //  - the URL of a profile picture: picture.data.url
  //  - the user's gender: gender
  //  - the user's birth day: birthday
  return wrapAsyncAction(AUTHENTICATE_USER, () => authenticate({
    email: facebookAuth.email,
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
    if (facebookAuth.gender && _FACEBOOK_GENDER_MAPPING[facebookAuth.gender]) {
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

function googleAuthenticateUser(googleAuth, mockApi) {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return wrapAsyncAction(AUTHENTICATE_USER, () => authenticate({
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
    const {lastName, name} = authResponse.authenticatedUser.profile || {}
    return {
      ...authResponse,
      authenticatedUser: {
        ...authResponse.authenticatedUser,
        profile: {
          ...authResponse.authenticatedUser.profile,
          lastName: lastName || profile.getFamilyName() || ' ',
          name: name || profile.getGivenName() || profile.getEmail().replace(/@.*$/, ''),
        },
      },
    }
  }))
}

function peConnectAuthenticateUser(code, nonce, mockApi) {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return wrapAsyncAction(AUTHENTICATE_USER, () => authenticate({
    peConnectCode: code,
    peConnectNonce: nonce,
  }))
}

function emailCheck(email) {
  return wrapAsyncAction(EMAIL_CHECK, () => userAuthenticate({email}))
}

function registerNewUser(email, password, firstName, lastName) {
  return wrapAsyncAction(AUTHENTICATE_USER, () => userAuthenticate({
    email,
    firstName,
    hashedPassword: sha1(email + password),
    lastName,
  }))
}

function loginUser(email, password, hashSalt) {
  return dispatch => {
    return dispatch(wrapAsyncAction(
      AUTHENTICATE_USER, () => userAuthenticate({
        email, hashSalt, hashedPassword: sha1(hashSalt + sha1(email + password))})))
  }
}

function loginUserFromToken(userId, authToken) {
  return dispatch =>
    dispatch(wrapAsyncAction(AUTHENTICATE_USER, () => userAuthenticate({authToken, userId})))
}

function markChangelogAsSeen(changelog) {
  return (dispatch, getState) => {
    dispatch({changelog, type: MARK_CHANGELOG_AS_SEEN})
    dispatch(saveUser(getState().user))
  }
}

function markNotificationAsSeen(notification) {
  return (dispatch, getState) => {
    dispatch({notification, type: MARK_NOTIFICATION_AS_SEEN})
    dispatch(saveUser(getState().user))
  }
}

function migrateUserToAdvisor() {
  return (dispatch, getState) => {
    const {authToken} = getState().app
    return dispatch(wrapAsyncAction(
      MIGRATE_USER_TO_ADVISOR, () => migrateUserToAdvisorPost(getState().user, authToken)))
  }
}

function resetPassword(email, password, authToken) {
  return wrapAsyncAction(AUTHENTICATE_USER, () => userAuthenticate({
    authToken, email, hashedPassword: sha1(email + password)}))
}

function setUserProfile(userProfile, shouldAlsoSaveUser, type) {
  return (dispatch, getState) => {
    // Drop unknown kinds.
    // TODO(pascal): Check that gender, situation, jobSearchPhase
    // are consistent with their kinds, if they exist.
    dispatch({type: type || SET_USER_PROFILE, userProfile})
    if (shouldAlsoSaveUser) {
      return dispatch(saveUser(getState().user))
    }
    return Promise.resolve()
  }
}

function scoreAdvice(project, advice, score) {
  return (dispatch, getState) => {
    dispatch({advice, project, score, type: SCORE_ADVICE})
    return dispatch(saveUser(getState().user))
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
    const {authToken} = getState().app
    const project = projects && projects[0] || {}
    dispatch({project, type: CREATE_PROJECT})
    // Don't use normal saveUser to be able to distinguish between project creation and user saving.
    return dispatch(wrapAsyncAction(
      CREATE_PROJECT_SAVE, () => userPost(getState().user, authToken)))
  }
}

function modifyProject(project) {
  return dispatch => {
    push(`${Routes.PROFILE_PAGE}/profil`)
    dispatch({project, type: MODIFY_PROJECT})
  }
}

function askPasswordReset(email) {
  return wrapAsyncAction(RESET_USER_PASSWORD, () => resetPasswordPost(email))
}

function getEvalUseCasePools() {
  return (dispatch, getState) => {
    const {googleIdToken} = getState().auth || {}
    return dispatch(wrapAsyncAction(
      GET_EVAL_USE_CASE_POOLS, () => evalUseCasePoolsGet(googleIdToken)))
  }
}

function getEvalUseCases(poolName) {
  return (dispatch, getState) => {
    const {googleIdToken} = getState().auth || {}
    return dispatch(wrapAsyncAction(
      GET_EVAL_USE_CASES, () => evalUseCasesGet(poolName, googleIdToken)))
  }
}

function getUserCount() {
  return dispatch => {
    return dispatch(wrapAsyncAction(
      GET_USER_COUNT, () => userCountGet()))
  }
}

export {saveUser, hideToasterMessageAction, setUserProfile, fetchUser,
  readTip, facebookAuthenticateUser, sendAdviceFeedback, modifyProject,
  googleAuthenticateUser, emailCheck, registerNewUser, loginUser, logoutAction,
  createFirstProject, fetchProjectRequirements, resetPassword,
  editFirstProject, sendProfessionalFeedback, diagnoseProject,
  getDashboardExport, displayToasterMessage, closeLoginModal,
  openLoginModal, acceptCookiesUsageAction, switchToMobileVersionAction,
  loadLandingPage, deleteUser, askPasswordReset, selectAdvice,
  openTipExternalLink, advicePageIsShown, seeAdvice, markChangelogAsSeen,
  adviceCardIsShown, getAdviceTips, explorerIsShown,
  showAllTips, migrateUserToAdvisor, getJobs, markNotificationAsSeen,
  shareProductToNetwork, trackInitialUtm, peConnectAuthenticateUser,
  sendProjectFeedback, scoreAdvice, sendChangelogFeedback,
  landingPageSectionIsShown, openRegistrationModal, sendNewAdviceIdea, computeAdvicesForProject,
  getEvalUseCasePools, getEvalUseCases, getExpandedCardContent,
  getUserCount, activateDemoInFuture, activateDemo, diagnosticIsShown, downloadDiagnosticAsPdf,
  productUpdatedPageIsShownAction, loginUserFromToken, shareProductModalIsShown,
}

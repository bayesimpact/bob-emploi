import sha1 from 'sha1'

import {splitFullName} from 'store/auth'
import {upperFirstLetter} from 'store/french'
import {newProject} from 'store/project'

import {adviceTipsGet, evalUseCasePoolsGet, evalUseCasesGet, advicePost, projectPost,
  jobRequirementsGet, jobsGet, userDelete, markUsedAndRetrievePost,
  userPost, feedbackPost, userAuthenticate, resetPasswordPost, onboardingDiagnosePost,
  migrateUserToAdvisorPost, projectComputeAdvicesPost, expandedCardContentGet,
  projectDiagnosePost, convertUserWithAdviceSelectionFromProtoPost,
  convertUserWithAdviceSelectionToProtoPost} from './api'

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
export const FINISH_PROFILE_SETTINGS = 'FINISH_PROFILE_SETTINGS'
export const READ_TIP = 'READ_TIP'
export const CREATE_PROJECT = 'CREATE_PROJECT'
export const CREATE_PROJECT_SAVE = 'CREATE_PROJECT_SAVE'
export const EDIT_FIRST_PROJECT = 'EDIT_FIRST_PROJECT'
export const FINISH_PROJECT_GOAL = 'FINISH_PROJECT_GOAL'
export const FINISH_PROJECT_CRITERIA = 'FINISH_PROJECT_CRITERIA'
export const FINISH_PROJECT_EXPERIENCE = 'FINISH_PROJECT_EXPERIENCE'
export const MIGRATE_USER_TO_ADVISOR = 'MIGRATE_USER_TO_ADVISOR'
export const MODIFY_PROJECT = 'MODIFY_PROJECT'
export const MARK_CHANGELOG_AS_SEEN = 'MARK_CHANGELOG_AS_SEEN'
export const EXPLORE_ADVICE = 'EXPLORE_ADVICE'
export const DIAGNOSE_ONBOARDING = 'DIAGNOSE_ONBOARDING'

// App actions.

export const ACTIVATE_DEMO = 'ACTIVATE_DEMO'
export const CLOSE_LOGIN_MODAL = 'CLOSE_LOGIN_MODAL'
export const CONVERT_PROTO = 'CONVERT_PROTO'
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
export const TRACK_INITIAL_FEATURES = 'TRACK_INITIAL_FEATURES'
export const DIAGNOSTIC_TALK_IS_SHOWN = 'DIAGNOSTIC_TALK_IS_SHOWN'
export const DIAGNOSTIC_IS_SHOWN = 'DIAGNOSTIC_IS_SHOWN'
export const COMPUTE_ADVICES_FOR_PROJECT = ' COMPUTE_ADVICES_FOR_PROJECT'
export const DIAGNOSE_PROJECT = 'DIAGNOSE_PROJECT'
export const GET_EVAL_USE_CASE_POOLS = 'GET_EVAL_USE_CASE_POOLS'
export const GET_EVAL_USE_CASES = 'GET_EVAL_USE_CASES'
export const GET_EXPANDED_CARD_CONTENT = 'GET_EXPANDED_CARD_CONTENT'
export const DOWNLOAD_DIAGNOSTIC_PDF = 'DOWNLOAD_DIAGNOSTIC_PDF'
export const WILL_ACTIVATE_DEMO = 'WILL_ACTIVATE_DEMO'
export const PRODUCT_UPDATED_PAGE_IS_SHOWN = 'PRODUCT_UPDATED_PAGE_IS_SHOWN'
export const PAGE_IS_LOADED = 'PAGE_IS_LOADED'
export const WORKBENCH_IS_SHOWN = 'WORKBENCH_IS_SHOWN'
export const TRIGGER_QUICK_DIAGNOSTIC = 'TRIGGER_QUICK_DIAGNOSTIC'
export const CLOSE_QUICK_DIAGNOSTIC = 'CLOSE_QUICK_DIAGNOSTIC'
export const IDLE_QUICK_DIAGNOSTIC = 'IDLE_QUICK_DIAGNOSTIC'
export const CHANGE_SUBMETRIC_EXPANSION = 'CHANGE_SUBMETRIC_EXPANSION'


// Logging only.
const LANDING_PAGE_SECTION_IS_SHOWN = 'LANDING_PAGE_SECTION_IS_SHOWN'
const STATIC_ADVICE_PAGE_IS_SHOWN = 'STATIC_ADVICE_PAGE_IS_SHOWN'

// Set of actions we want to log in the analytics
export const actionTypesToLog = {
  [ACCEPT_PRIVACY_NOTICE]: 'Accept privacy notice',
  [ADVICE_CARD_IS_SHOWN]: 'Advice card is shown',
  [ADVICE_PAGE_IS_SHOWN]: 'Advice page shown',
  [AUTHENTICATE_USER]: 'Log in',
  [CLOSE_QUICK_DIAGNOSTIC]: 'Leave the anonymous diagnostic page',
  [CREATE_PROJECT]: 'Create project',
  [CREATE_PROJECT_SAVE]: 'Save project',
  [DELETE_USER_DATA]: 'Delete user',
  [DIAGNOSTIC_IS_SHOWN]: 'Diagnostic is shown',
  [DIAGNOSTIC_TALK_IS_SHOWN]: 'Introductory text to diagnostic is shown',
  [DISPLAY_TOAST_MESSAGE]: 'Display toast message',
  [DOWNLOAD_DIAGNOSTIC_PDF]: 'Download the diagnostic as a PDF',
  [EXPLORE_ADVICE]: 'Explore advice (link or info)',
  [FINISH_PROFILE_FRUSTRATIONS]: 'Finish profile frustrations',
  [FINISH_PROFILE_SETTINGS]: 'Finish profile settings',
  [FINISH_PROFILE_SITUATION]: 'Finish profile situation',
  [FINISH_PROJECT_CRITERIA]: 'Finish project criteria',
  [FINISH_PROJECT_EXPERIENCE]: 'Finish project experience',
  [FINISH_PROJECT_GOAL]: 'Finish project goal',
  [GET_USER_DATA]: 'Load app',
  [IDLE_QUICK_DIAGNOSTIC]: 'The anonymous diagnostic page has been open for a long time',
  [LANDING_PAGE_SECTION_IS_SHOWN]: 'A landing page section is shown',
  [LOAD_LANDING_PAGE]: 'Load landing page',
  [LOGOUT]: 'Log out',
  [MARK_CHANGELOG_AS_SEEN]: 'Mark Changelog as seen',
  [MIGRATE_USER_TO_ADVISOR]: 'Migrate to advisor',
  [MODIFY_PROJECT]: 'Modify project',
  [OPEN_LOGIN_MODAL]: 'Open login modal',
  [OPEN_REGISTER_MODAL]: 'Open register modal',
  [OPEN_TIP_EXTERNAL_LINK]: 'Open tip external link',
  [PRODUCT_UPDATED_PAGE_IS_SHOWN]: 'Product has been updated page shown',
  [READ_TIP]: 'Open tip',
  [REGISTER_USER]: 'Register new user',
  [RESET_USER_PASSWORD]: 'Ask password email',
  [SEE_ADVICE]: 'See advice in dashboard',
  [SEND_ADVICE_FEEDBACK]: 'Send advice feedback',
  [SEND_CHANGELOG_FEEDBACK]: 'Send feedback from the changelog modal',
  [SEND_PROFESSIONAL_FEEDBACK]: 'Send feedback from professional page',
  [SEND_PROJECT_FEEDBACK]: 'Send project feedback',
  [SET_USER_PROFILE]: 'Update profile',
  [SHARE_PRODUCT_MODAL_IS_SHOWN]: 'Share product modal is shown',
  [SHARE_PRODUCT_TO_NETWORK]: 'Share product to network',
  [SHOW_ALL_TIPS]: 'Show all tips',
  [STATIC_ADVICE_PAGE_IS_SHOWN]: 'A static advice page is shown',
  [TRIGGER_QUICK_DIAGNOSTIC]: 'Trigger an anonymous diagnostic',
  [WORKBENCH_IS_SHOWN]: 'The workbench is shown',
}

function isActionRegister({response, type}) {
  return type === AUTHENTICATE_USER && response && response.isNewUser
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
const closeQuickDiagnostic = {type: CLOSE_QUICK_DIAGNOSTIC}
const hideToasterMessageAction = {type: HIDE_TOASTER_MESSAGE}
const idleQuickDiagnostic = {type: IDLE_QUICK_DIAGNOSTIC}
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

function changeSubmetricExpansion(topic, isExpanded) {
  return dispatch => dispatch({isExpanded, topic, type: CHANGE_SUBMETRIC_EXPANSION})
}

function closeLoginModal(hasCanceledLogin) {
  return {hasCanceledLogin, type: CLOSE_LOGIN_MODAL}
}

function diagnosticIsShown(project) {
  return dispatch => dispatch({project, type: DIAGNOSTIC_IS_SHOWN})
}

function diagnosticTalkIsShown(project) {
  return dispatch => dispatch({project, type: DIAGNOSTIC_TALK_IS_SHOWN})
}

function displayToasterMessage(error) {
  return dispatch => dispatch({error, type: DISPLAY_TOAST_MESSAGE})
}

function downloadDiagnosticAsPdf(project) {
  return dispatch => dispatch({project, type: DOWNLOAD_DIAGNOSTIC_PDF})
}

function landingPageSectionIsShown(sectionName) {
  return dispatch => dispatch({type: LANDING_PAGE_SECTION_IS_SHOWN, visualElement: sectionName})
}

function modifyProject(project) {
  return dispatch => dispatch({project, type: MODIFY_PROJECT})
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

// TODO(marielaure): Use a  dedicated field here instead of visualElement.
function staticAdvicePageIsShown(adviceId) {
  return dispatch => dispatch({type: STATIC_ADVICE_PAGE_IS_SHOWN, visualElement: adviceId})
}

function workbenchIsShown(project) {
  return dispatch => dispatch({project, type: WORKBENCH_IS_SHOWN})
}

function trackInitialUtm(utm) {
  return dispatch => dispatch({type: TRACK_INITIAL_UTM, utm})
}

function trackInitialFeatures(features) {
  return dispatch => dispatch({features, type: TRACK_INITIAL_FEATURES})
}

// Asynchronous action generators.

// Wrap an async function by dispatching an action before and after the
// function: the initial action has the given type and an ASYNC_MARKER, the
// final action has the same type and marker but also a status 'success' or
// 'error' with additional response or error var. The asyncFunc doesn't take
// any parameter and should return a promise.
// The promise returned by this function always resolve, to undefined if
// there's an error.
function wrapAsyncAction(actionType, asyncFunc, options) {
  return dispatch => {
    const action = {...options, ASYNC_MARKER, type: actionType}
    dispatch(action)
    const promise = asyncFunc()
    return promise.then(
      result => {
        dispatch({...action, response: result, status: 'success'})
        return result
      },
      error => {
        dispatch({...action, error: error, status: 'error'})
      },
    )
  }
}

// Asynchronous actions wrapped with the dispatched actions (see wrapAsyncAction).

function computeAdvicesForProject(user) {
  return wrapAsyncAction(COMPUTE_ADVICES_FOR_PROJECT, () => projectComputeAdvicesPost(user))
}

function convertUserWithAdviceSelectionFromProto(proto) {
  return wrapAsyncAction(CONVERT_PROTO, () => convertUserWithAdviceSelectionFromProtoPost(proto))
}

function convertUserWithAdviceSelectionToProto(proto) {
  return wrapAsyncAction(CONVERT_PROTO, () => convertUserWithAdviceSelectionToProtoPost(proto))
}

function diagnoseProject(user, source) {
  return wrapAsyncAction(DIAGNOSE_PROJECT, () => projectDiagnosePost(user, source))
}

function quickDiagnose(city, job) {
  return dispatch => {
    const project = {city, targetJob: job}
    dispatch({...project, type: TRIGGER_QUICK_DIAGNOSTIC})
    return dispatch(diagnoseProject({projects: [project]}))
  }
}

function getAdviceTips(project, advice) {
  return (dispatch, getState) => {
    const {user, app} = getState()
    return dispatch(wrapAsyncAction(
      GET_ADVICE_TIPS, () => adviceTipsGet(user, project, advice, app.authToken),
      {advice, project}))
  }
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
    // TODO(cyrille): Remove if this is redundant with user_reducer.
    const trackedUser = user.origin ? user : {
      ...user,
      origin: initialUtm || undefined,
    }
    return dispatch(wrapAsyncAction(POST_USER_DATA, () => userPost(trackedUser, authToken)))
  }
}

function diagnoseOnboarding(userDiff) {
  return (dispatch, getState) => {
    const {app: {authToken}, user: {userId}} = getState()
    // Make an empty incomplete project if there's none.
    if (userDiff.projects && userDiff.projects.length) {
      userDiff.projects[0].isIncomplete = true
    }
    userDiff.userId = userId
    return dispatch(wrapAsyncAction(DIAGNOSE_ONBOARDING, () =>
      onboardingDiagnosePost({user: userDiff}, authToken), {user: userDiff}))
  }
}

function activateDemo(demo) {
  return (dispatch, getState) => {
    dispatch({demo, type: ACTIVATE_DEMO})
    return dispatch(saveUser(getState().user))
  }
}

function updateProject(type, project, projectDiff, options) {
  return (dispatch, getState) => {
    const {app: {authToken}, user} = getState()
    return dispatch(wrapAsyncAction(
      type,
      () => {
        if (user.userId) {
          return projectPost(user, project, projectDiff, authToken)
        }
        return Promise.resolve({...project, ...projectDiff})
      },
      {project, projectDiff, ...options},
    ))
  }
}

function updateAdvice(type, project, advice, adviceDiff, options) {
  return (dispatch, getState) => {
    const {app: {authToken}, user} = getState()
    return dispatch(wrapAsyncAction(
      type,
      () => {
        if (user.userId) {
          return advicePost(user, project, advice, adviceDiff, authToken)
        }
        return Promise.resolve({...advice, ...adviceDiff})
      },
      {advice, adviceDiff, project, ...options},
    ))
  }
}

function advicePageIsShown(project, advice) {
  return updateAdvice(ADVICE_PAGE_IS_SHOWN, project, advice, {status: 'ADVICE_READ'})
}

function exploreAdvice(project, advice, visualElement) {
  return updateAdvice(
    EXPLORE_ADVICE, project, advice,
    {numExplorations: (advice.numExplorations || 0) + 1},
    {visualElement})
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
    )).then(response => {
      if (response) {
        dispatch(displayToasterMessage('Merci pour ce retour'))
      }
      return response
    })
  }
}

function sendAdviceFeedback({projectId = ''} = {}, {adviceId}, feedback, score = 0) {
  return sendFeedback(
    SEND_ADVICE_FEEDBACK, 'ADVICE_FEEDBACK', feedback, {adviceId, projectId, score})
}

function sendProfessionalFeedback(feedback) {
  return sendFeedback(SEND_PROFESSIONAL_FEEDBACK, 'PROFESSIONAL_PAGE_FEEDBACK', feedback)
}

function sendProjectFeedback(project, feedback) {
  return dispatch => {
    return dispatch(updateProject(SEND_PROJECT_FEEDBACK, project, {feedback})).
      then(response => {
        if (response) {
          dispatch(displayToasterMessage('Merci pour ce retour !'))
        }
        return response
      })
  }
}

function sendChangelogFeedback(feedback) {
  return sendFeedback(SEND_CHANGELOG_FEEDBACK, 'CHANGELOG_FEEDBACK', feedback)
}

const _FACEBOOK_GENDER_MAPPING = {
  'female': 'FEMININE',
  'male': 'MASCULINE',
}

function asyncAuthenticate(authenticate, authRequest, method, callback) {
  return (dispatch, getState) => {
    const {initialFeatures} = getState().app
    if (initialFeatures) {
      authRequest.userData = initialFeatures
    }
    return dispatch(wrapAsyncAction(
      AUTHENTICATE_USER,
      () => authenticate(authRequest).then(callback),
      {method}
    ))
  }
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
  return asyncAuthenticate(authenticate, {
    email: facebookAuth.email,
    facebookSignedRequest: facebookAuth.signedRequest,
  }, 'facebook', authResponse => {
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
  })
}


function googleAuthenticateUser(googleAuth, mockApi) {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {
    googleTokenId: googleAuth.getAuthResponse().id_token,
  }, 'google', authResponse => {
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
  })
}

function peConnectAuthenticateUser(code, nonce, mockApi) {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {
    peConnectCode: code,
    peConnectNonce: nonce,
  }, 'peConnect')
}

function linkedInAuthenticateUser(code, mockApi) {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {linkedInCode: code}, 'linkedIn')
}

function emailCheck(email) {
  return wrapAsyncAction(EMAIL_CHECK, () => userAuthenticate({email}), {method: 'password'})
}

function registerNewUser(email, password, firstName, lastName) {
  const cleanEmail = email.trim()
  return asyncAuthenticate(userAuthenticate, {
    email: cleanEmail,
    firstName: upperFirstLetter(firstName.trim()),
    hashedPassword: sha1(cleanEmail + password),
    lastName: upperFirstLetter(lastName.trim()),
  }, 'password')
}

function loginUser(email, password, hashSalt) {
  const cleanEmail = email.trim()
  return asyncAuthenticate(userAuthenticate, {
    email: cleanEmail,
    hashSalt,
    hashedPassword: sha1(hashSalt + sha1(cleanEmail + password)),
  }, 'password')
}

function loginUserFromToken(userId, authToken) {
  return wrapAsyncAction(AUTHENTICATE_USER, () => userAuthenticate({authToken, userId}))
}

function markChangelogAsSeen(changelog) {
  return (dispatch, getState) => {
    dispatch({changelog, type: MARK_CHANGELOG_AS_SEEN})
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

function pageIsLoaded(location) {
  return {location: location || window.location, type: PAGE_IS_LOADED}
}

function resetPassword(email, password, authToken) {
  const cleanEmail = email.trim()
  return wrapAsyncAction(AUTHENTICATE_USER, () => userAuthenticate({
    authToken, email: cleanEmail, hashedPassword: sha1(cleanEmail + password)}))
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
    const {app: {authToken}, user: {projects: [project = {}] = []}} = getState()
    dispatch({project, type: CREATE_PROJECT})
    // Don't use normal saveUser to be able to distinguish between project creation and user saving.
    return dispatch(wrapAsyncAction(
      CREATE_PROJECT_SAVE, () => userPost(getState().user, authToken)))
  }
}

function askPasswordReset(email) {
  return wrapAsyncAction(RESET_USER_PASSWORD, () => resetPasswordPost(email))
}

function getEvalUseCasePools() {
  return (dispatch, getState) => {
    const {fetchGoogleIdToken} = getState().auth || {}
    return dispatch(wrapAsyncAction(GET_EVAL_USE_CASE_POOLS, () => fetchGoogleIdToken().
      then(googleIdToken => evalUseCasePoolsGet(googleIdToken))))
  }
}

function getEvalUseCases(poolName) {
  return (dispatch, getState) => {
    const {fetchGoogleIdToken} = getState().auth || {}
    return dispatch(wrapAsyncAction(GET_EVAL_USE_CASES, () => fetchGoogleIdToken().
      then(googleIdToken => evalUseCasesGet(poolName, googleIdToken))))
  }
}


export {saveUser, hideToasterMessageAction, setUserProfile, fetchUser,
  readTip, facebookAuthenticateUser, sendAdviceFeedback, modifyProject,
  googleAuthenticateUser, emailCheck, registerNewUser, loginUser, logoutAction,
  createFirstProject, fetchProjectRequirements, resetPassword,
  editFirstProject, sendProfessionalFeedback, diagnoseProject,
  displayToasterMessage, closeLoginModal, closeQuickDiagnostic, idleQuickDiagnostic,
  openLoginModal, acceptCookiesUsageAction, switchToMobileVersionAction,
  loadLandingPage, deleteUser, askPasswordReset,
  openTipExternalLink, advicePageIsShown, seeAdvice, markChangelogAsSeen,
  adviceCardIsShown, getAdviceTips, showAllTips, migrateUserToAdvisor, getJobs,
  shareProductToNetwork, trackInitialUtm, trackInitialFeatures,
  peConnectAuthenticateUser, sendProjectFeedback,
  sendChangelogFeedback, landingPageSectionIsShown, openRegistrationModal,
  computeAdvicesForProject, diagnosticTalkIsShown,
  getEvalUseCasePools, getEvalUseCases, getExpandedCardContent,
  activateDemoInFuture, activateDemo, diagnosticIsShown, downloadDiagnosticAsPdf,
  productUpdatedPageIsShownAction, loginUserFromToken, shareProductModalIsShown,
  staticAdvicePageIsShown, linkedInAuthenticateUser, pageIsLoaded,
  isActionRegister, workbenchIsShown,
  exploreAdvice, diagnoseOnboarding, convertUserWithAdviceSelectionFromProto,
  convertUserWithAdviceSelectionToProto, quickDiagnose,
  changeSubmetricExpansion,
}

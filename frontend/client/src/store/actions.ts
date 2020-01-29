import {TFunction} from 'i18next'
import {ReactFacebookLoginInfo} from 'react-facebook-login'
import {GoogleLoginResponse} from 'react-google-login'
import {Action, Dispatch} from 'redux'
import {ThunkAction, ThunkDispatch} from 'redux-thunk'
import sha1 from 'sha1'

import {upperFirstLetter} from 'store/french'
import {newProject} from 'store/project'

import {adviceTipsGet, evalUseCasePoolsGet, evalUseCasesGet, advicePost, projectPost,
  jobRequirementsGet, jobsGet, userDelete, markUsedAndRetrievePost, evalFiltersUseCasesPost,
  userPost, feedbackPost, userAuthenticate, resetPasswordPost, onboardingDiagnosePost,
  migrateUserToAdvisorPost, projectComputeAdvicesPost, expandedCardContentGet, strategyPost,
  projectDiagnosePost, convertUserWithAdviceSelectionFromProtoPost, useCaseDistributionPost,
  convertUserWithAdviceSelectionToProtoPost, projectStrategizePost, projectLaborStatsPost,
  getAllCategoriesPost, createEvalUseCasePost, applicationModesGet, supportTicketPost,
  simulateFocusEmailsPost, strategyDelete,
} from './api'

const ASYNC_MARKER = 'ASYNC_MARKER'

// Set of actions we want to log in the analytics
export const actionTypesToLog = {
  ACCEPT_PRIVACY_NOTICE: 'Accept privacy notice',
  ADVICE_CARD_IS_SHOWN: 'Advice card is shown',
  ADVICE_PAGE_IS_SHOWN: 'Advice page shown',
  AUTHENTICATE_USER: 'Log in',
  CREATE_PROJECT: 'Create project',
  CREATE_PROJECT_SAVE: 'Save project',
  DELETE_USER_DATA: 'Delete user',
  DIAGNOSTIC_IS_SHOWN: 'Diagnostic is shown',
  DIAGNOSTIC_TALK_IS_SHOWN: 'Introductory text to diagnostic is shown',
  DISPLAY_TOAST_MESSAGE: 'Display toast message',
  DOWNLOAD_DIAGNOSTIC_PDF: 'Download the diagnostic as a PDF',
  EXPLORE_ADVICE: 'Explore advice (link or info)',
  FINISH_PROFILE_FRUSTRATIONS: 'Finish profile frustrations',
  FINISH_PROFILE_SETTINGS: 'Finish profile settings',
  FINISH_PROFILE_SITUATION: 'Finish profile situation',
  FINISH_PROJECT_CRITERIA: 'Finish project criteria',
  FINISH_PROJECT_EXPERIENCE: 'Finish project experience',
  FINISH_PROJECT_GOAL: 'Finish project goal',
  FOLLOW_JOB_OFFERS_LINK: 'Follow a link to job offers',
  GET_USER_DATA: 'Load app',
  LANDING_PAGE_SECTION_IS_SHOWN: 'A landing page section is shown',
  LOAD_LANDING_PAGE: 'Load landing page',
  LOGOUT: 'Log out',
  MARK_CHANGELOG_AS_SEEN: 'Mark Changelog as seen',
  MIGRATE_USER_TO_ADVISOR: 'Migrate to advisor',
  MODIFY_PROJECT: 'Modify project',
  OPEN_LOGIN_MODAL: 'Open login modal',
  OPEN_REGISTER_MODAL: 'Open register modal',
  OPEN_STATS_PAGE: 'Open a link to market statistical information',
  OPEN_TIP_EXTERNAL_LINK: 'Open tip external link',
  PAGE_IS_LOADED: 'Page is loaded',
  READ_TIP: 'Open tip',
  REGISTER_USER: 'Register new user',
  REPLACE_STRATEGY: 'Update strategy advancement',
  RESET_USER_PASSWORD: 'Ask password email',
  SEE_ADVICE: 'See advice in dashboard',
  SEND_ADVICE_FEEDBACK: 'Send advice feedback',
  SEND_CHANGELOG_FEEDBACK: 'Send feedback from the changelog modal',
  SEND_PROFESSIONAL_FEEDBACK: 'Send feedback from professional page',
  SEND_PROJECT_FEEDBACK: 'Send project feedback',
  SET_USER_PROFILE: 'Update profile',
  SHARE_PRODUCT_MODAL_IS_SHOWN: 'Share product modal is shown',
  SHARE_PRODUCT_TO_NETWORK: 'Share product to network',
  SHOW_ALL_TIPS: 'Show all tips',
  START_AS_GUEST: 'Start as guest',
  START_STRATEGY: 'Start a job search strategy',
  STATIC_ADVICE_PAGE_IS_SHOWN: 'A static advice page is shown',
  STATS_PAGE_IS_SHOWN: 'The statistics page is shown',
  STRATEGY_EXPLORATION_PAGE_IS_SHOWN: 'A strategy page is shown in exploration mode',
  STRATEGY_WORK_PAGE_IS_SHOWN: 'A strategy page is shown in work mode',
  WORKBENCH_IS_SHOWN: 'The workbench is shown',
}

interface PotentialRegisterAction {
  response?: {
    isNewUser?: boolean
  }
  type?: string
}

function isActionRegister({response, type}: PotentialRegisterAction): boolean {
  return !!(type === 'AUTHENTICATE_USER' && response && response.isNewUser)
}


// Get the list of paths of defined fields.
// Only exported for testing.
export function getDefinedFieldsPath<T extends {}>(proto: T, prefix = ''): readonly string[] {
  if (typeof proto !== 'object' || !proto || Array.isArray(proto)) {
    return []
  }
  let paths: string[] = []
  // TODO(pascal): Use flatMap, once it's properly added in our typescript and polyfill configs.
  Object.keys(proto).forEach((key: string): void => {
    const value = proto[key as keyof T]
    if (typeof value === 'undefined') {
      return
    }
    const subPaths = getDefinedFieldsPath(value, prefix + key + '.')
    if (!subPaths.length) {
      paths.push(prefix + key)
    } else {
      paths = paths.concat(subPaths)
    }
  })
  return paths
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

export type AcceptCookiesUsageAction = Readonly<Action<'ACCEPT_COOKIES_USAGE'>>
const acceptCookiesUsageAction: AcceptCookiesUsageAction = {type: 'ACCEPT_COOKIES_USAGE'}

export type ClearExpiredTokenAction = Readonly<Action<'CLEAR_EXPIRED_TOKEN'>>
const clearExpiredTokenAction: ClearExpiredTokenAction = {type: 'CLEAR_EXPIRED_TOKEN'}

export type HideToasterMessageAction = Readonly<Action<'HIDE_TOASTER_MESSAGE'>>
const hideToasterMessageAction: HideToasterMessageAction = {type: 'HIDE_TOASTER_MESSAGE'}

export type LogoutAction = Readonly<Action<'LOGOUT'>>
const logoutAction: LogoutAction = {type: 'LOGOUT'}

// TODO(pascal): Rename that action as it's not opening the internal Stats Page, but the Pôle emploi
// one.
export type OpenStatsPageAction = Readonly<Action<'OPEN_STATS_PAGE'>>
const openStatsPageAction: OpenStatsPageAction = {type: 'OPEN_STATS_PAGE'}

export type RemoveAuthDataAction = Readonly<Action<'REMOVE_AUTH_DATA'>>
const removeAuthData: RemoveAuthDataAction = {type: 'REMOVE_AUTH_DATA'}

export type FollowJobOffersLinkAction = Readonly<Action<'FOLLOW_JOB_OFFERS_LINK'>>
const followJobOffersLinkAction: FollowJobOffersLinkAction = {type: 'FOLLOW_JOB_OFFERS_LINK'}

export type SwitchToMobileVersionAction = Readonly<Action<'SWITCH_TO_MOBILE_VERSION'>>
const switchToMobileVersionAction: SwitchToMobileVersionAction = {type: 'SWITCH_TO_MOBILE_VERSION'}

// Synchronous action generators, keep them grouped and alpha sorted.

export interface ProjectAction<T extends string> extends Readonly<Action<T>> {
  readonly project: bayes.bob.Project
}

export interface StrategyAction<T extends string> extends ProjectAction<T> {
  readonly strategyRank?: number
  readonly strategy: bayes.bob.Strategy
}

export interface AdviceAction<T extends string> extends ProjectAction<T> {
  readonly advice: bayes.bob.Advice
}

export interface VisualElementAction<T extends string> extends Readonly<Action<T>> {
  readonly visualElement: string
}

export interface TipAction<T extends string> extends Readonly<Action<T>> {
  readonly action: {
    readonly actionId: string
  } & bayes.bob.Action
}

export interface ActivateDemoInFutureAction extends Readonly<Action<'WILL_ACTIVATE_DEMO'>> {
  readonly demo: keyof bayes.bob.Features
}
function activateDemoInFuture(demo: keyof bayes.bob.Features): ActivateDemoInFutureAction {
  return {demo, type: 'WILL_ACTIVATE_DEMO'}
}

type AdviceCardIsShownAction = AdviceAction<'ADVICE_CARD_IS_SHOWN'>

function adviceCardIsShown(project: bayes.bob.Project, advice: bayes.bob.Advice):
AdviceCardIsShownAction {
  return {advice, project, type: 'ADVICE_CARD_IS_SHOWN'}
}

interface ChangeSubmetricExpansionAction extends
  Readonly<Action<'CHANGE_SUBMETRIC_EXPANSION'>> {
  readonly isExpanded: boolean
  readonly topic: string
}

interface OpenLoginModalActionBase<T extends string> extends VisualElementAction<T> {
  readonly defaultValues: {
    email?: string
    isReturningUser?: boolean
    resetToken?: string
  }
}

function changeSubmetricExpansion(topic: string, isExpanded: boolean):
ChangeSubmetricExpansionAction {
  return {isExpanded, topic, type: 'CHANGE_SUBMETRIC_EXPANSION'}
}

interface CloseLoginModalAction extends Readonly<Action<'CLOSE_LOGIN_MODAL'>> {
  readonly hasCanceledLogin?: boolean
}

// TODO(pascal): Check if we need hasCanceledLogin somehow.
function closeLoginModal(unusedHasCanceledLogin?: boolean):
ThunkAction<CloseLoginModalAction, RootState, {}, AllActions> {
  return (dispatch): CloseLoginModalAction => {
    return dispatch({type: 'CLOSE_LOGIN_MODAL'})
  }
}

interface CommentIsShown extends Readonly<Action<'COMMENT_IS_SHOWN'>> {
  readonly commentKey: string
}

function commentIsShown(commentKey: string): CommentIsShown {
  return {commentKey, type: 'COMMENT_IS_SHOWN'}
}

type DiagnosticTalkIsShownAction = ProjectAction<'DIAGNOSTIC_TALK_IS_SHOWN'>

function diagnosticTalkIsShown(project: bayes.bob.Project): DiagnosticTalkIsShownAction {
  return {project, type: 'DIAGNOSTIC_TALK_IS_SHOWN'}
}

export interface DisplayToastMessageAction extends Readonly<Action<'DISPLAY_TOAST_MESSAGE'>> {
  readonly error: string
}

function displayToasterMessage(error: string): DisplayToastMessageAction {
  return {error, type: 'DISPLAY_TOAST_MESSAGE'}
}

type DownloadDiagnosticPdfAction = ProjectAction<'DOWNLOAD_DIAGNOSTIC_PDF'>

function downloadDiagnosticAsPdf(project: bayes.bob.Project): DownloadDiagnosticPdfAction {
  return {project, type: 'DOWNLOAD_DIAGNOSTIC_PDF'}
}

type LandingPageSectionIsShownAction = VisualElementAction<'LANDING_PAGE_SECTION_IS_SHOWN'>

function landingPageSectionIsShown(sectionName: string): LandingPageSectionIsShownAction {
  return {type: 'LANDING_PAGE_SECTION_IS_SHOWN', visualElement: sectionName}
}

function modifyProject(project: bayes.bob.Project): ModifyProjectAction {
  return {project, type: 'MODIFY_PROJECT'}
}

type OpenLoginModalAction = OpenLoginModalActionBase<'OPEN_LOGIN_MODAL'>

function openLoginModal(defaultValues: {}, visualElement: string): OpenLoginModalAction {
  return {defaultValues, type: 'OPEN_LOGIN_MODAL', visualElement}
}

type OpenRegistrationModalAction = OpenLoginModalActionBase<'OPEN_REGISTER_MODAL'>

function openRegistrationModal(defaultValues: {}, visualElement: string):
OpenRegistrationModalAction {
  return {defaultValues, type: 'OPEN_REGISTER_MODAL', visualElement}
}

type OpenTipExternalLinkAction = TipAction<'OPEN_TIP_EXTERNAL_LINK'>

function openTipExternalLink(action: {actionId: string}): OpenTipExternalLinkAction {
  return {action, type: 'OPEN_TIP_EXTERNAL_LINK'}
}

export interface LoadLandingPageAction extends Readonly<Action<'LOAD_LANDING_PAGE'>> {
  readonly defaultProjectProps?: bayes.bob.Project
  readonly landingPageKind: string
}

function loadLandingPage(
  landingPageKind: string, specificJob: bayes.bob.Job|null): LoadLandingPageAction {
  return {
    defaultProjectProps: specificJob ? {targetJob: specificJob} : {},
    landingPageKind,
    type: 'LOAD_LANDING_PAGE',
  }
}

interface OnboardingCommentIsShownAction extends Readonly<Action<'ONBOARDING_COMMENT_IS_SHOWN'>> {
  comment: ValidDiagnosticComment
}

function onboardingCommentIsShown(comment: ValidDiagnosticComment):
OnboardingCommentIsShownAction {
  return {comment, type: 'ONBOARDING_COMMENT_IS_SHOWN'}
}

interface ReadTipAction extends TipAction<'READ_TIP'> {
  readonly feedback?: string
}

function readTip(action: {actionId: string}, feedback?: string): ReadTipAction {
  return {action, feedback, type: 'READ_TIP'}
}

type SeeAdviceAction = AdviceAction<'SEE_ADVICE'>

function seeAdvice(project: bayes.bob.Project, advice: bayes.bob.Advice): SeeAdviceAction {
  return {advice, project, type: 'SEE_ADVICE'}
}

type ShareProductModalIsShownAction = VisualElementAction<'SHARE_PRODUCT_MODAL_IS_SHOWN'>

function shareProductModalIsShown(visualElement: string): ShareProductModalIsShownAction {
  return {type: 'SHARE_PRODUCT_MODAL_IS_SHOWN', visualElement}
}

type ShareProductToNetworkAction = VisualElementAction<'SHARE_PRODUCT_TO_NETWORK'>

function shareProductToNetwork(visualElement: string): ShareProductToNetworkAction {
  return {type: 'SHARE_PRODUCT_TO_NETWORK', visualElement}
}

type ShowAllTipsAction = AdviceAction<'SHOW_ALL_TIPS'>

function showAllTips(project: bayes.bob.Project, advice: bayes.bob.Advice): ShowAllTipsAction {
  return {advice, project, type: 'SHOW_ALL_TIPS'}
}

type StartAsGuestAction = VisualElementAction<'START_AS_GUEST'> & {
  readonly defaultProjectProps?: bayes.bob.Project
}

function startAsGuest(
  visualElement: string, city?: bayes.bob.FrenchCity, targetJob?: bayes.bob.Job):
  StartAsGuestAction {
  return {
    defaultProjectProps: (city || targetJob) ? {city, targetJob} : undefined,
    type: 'START_AS_GUEST',
    visualElement,
  }
}

type StartStrategyAction = StrategyAction<'START_STRATEGY'>

function startStrategy(
  project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy, strategyRank: number,
): StartStrategyAction {
  return {project, strategy, strategyRank, type: 'START_STRATEGY'}
}

type StaticAdvicePageIsShownAction = VisualElementAction<'STATIC_ADVICE_PAGE_IS_SHOWN'>

// TODO(marielaure): Use a  dedicated field here instead of visualElement.
function staticAdvicePageIsShown(adviceId: string): StaticAdvicePageIsShownAction {
  return {type: 'STATIC_ADVICE_PAGE_IS_SHOWN', visualElement: adviceId}
}

type StatsPageIsShownAction = ProjectAction<'STATS_PAGE_IS_SHOWN'>

function statsPageIsShown(project: bayes.bob.Project): StatsPageIsShownAction {
  return {project, type: 'STATS_PAGE_IS_SHOWN'}
}

type StrategyExplorationPageIsShown = StrategyAction<'STRATEGY_EXPLORATION_PAGE_IS_SHOWN'>

// TODO(pascal): Drop if unused.
function strategyExplorationPageIsShown(
  project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy, strategyRank: number,
): StrategyExplorationPageIsShown {
  return {project, strategy, strategyRank, type: 'STRATEGY_EXPLORATION_PAGE_IS_SHOWN'}
}

type StrategyWorkPageIsShown = StrategyAction<'STRATEGY_WORK_PAGE_IS_SHOWN'>

function strategyWorkPageIsShown(
  project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy, strategyRank: number,
): StrategyWorkPageIsShown {
  return {project, strategy, strategyRank, type: 'STRATEGY_WORK_PAGE_IS_SHOWN'}
}

type WorkbenchIsShownAction = ProjectAction<'WORKBENCH_IS_SHOWN'>

function workbenchIsShown(project: bayes.bob.Project): WorkbenchIsShownAction {
  return {project, type: 'WORKBENCH_IS_SHOWN'}
}

interface TrackInitialUtmAction extends Readonly<Action<'TRACK_INITIAL_UTM'>>{
  readonly utm: {
    readonly source?: string
  }
}

function trackInitialUtm(utm: {}): TrackInitialUtmAction {
  return {type: 'TRACK_INITIAL_UTM', utm}
}

interface TrackInitialFeaturesAction extends Readonly<Action<'TRACK_INITIAL_FEATURES'>> {
  readonly features: {
    [featureId: string]: true
  }
}

// TODO(pascal): Consider removing.
function trackInitialFeatures(features: {}): TrackInitialFeaturesAction {
  return {features, type: 'TRACK_INITIAL_FEATURES'}
}

// Asynchronous action generators.

interface AsyncError {
  readonly error: Error | string
  readonly status: 'error'
}


export type AsyncAction<T extends string, Result> = Readonly<Action<T>> & {
  ASYNC_MARKER: 'ASYNC_MARKER'
  fetchKey?: string
  ignoreFailure?: boolean
} & ({readonly status?: ''} | AsyncError | {
  readonly response: Result
  readonly status: 'success'
})


interface AsyncStartedAction extends Action<'ASYNC_STARTED'> {
  fetchKey: string
  // TODO(pascal): Maybe try to improve the type of the result.
  promise: Promise<{}>
}


// Wrap an async function by dispatching an action before and after the
// function: the initial action has the given type and an ASYNC_MARKER, the
// final action has the same type and marker but also a status 'success' or
// 'error' with additional response or error var. The asyncFunc doesn't take
// any parameter and should return a promise.
// The promise returned by this function always resolve, to undefined if
// there's an error.
function wrapAsyncAction<T extends string, Extra, Result, A extends AsyncAction<T, Result> & Extra>(
  actionType: T, asyncFunc: () => Promise<Result>, options?: Extra, fetchKey?: string):
  ThunkAction<Promise<Result|void>, {}, {}, Action> {
  return (dispatch): Promise<Result|void> => {
    const action = {...options, ASYNC_MARKER, type: actionType}
    dispatch(action)
    const promise: Promise<Result> = asyncFunc()
    if (fetchKey) {
      dispatch({fetchKey, promise, type: 'ASYNC_STARTED'})
    }
    return promise.then(
      (result: Result): Result => {
        dispatch({...action, response: result, status: 'success'})
        return result
      },
      (error: Error): void => {
        dispatch({...action, error: error, status: 'error'})
      },
    )
  }
}

// Asynchronous actions wrapped with the dispatched actions (see wrapAsyncAction).

type ComputeAdvicesForProjectAction =
  AsyncAction<'COMPUTE_ADVICES_FOR_PROJECT', bayes.bob.Advices>

function computeAdvicesForProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Advices|void>, {}, {}, ComputeAdvicesForProjectAction> {
  return wrapAsyncAction(
    'COMPUTE_ADVICES_FOR_PROJECT',
    (): Promise<bayes.bob.Advices> => projectComputeAdvicesPost(user))
}

type ConvertUserWithAdvicesSelectionFromProtoAction =
  AsyncAction<'CONVERT_PROTO', bayes.bob.UserWithAdviceSelection>

function convertUserWithAdviceSelectionFromProto(proto: string):
ThunkAction<
Promise<bayes.bob.UserWithAdviceSelection | void>,
{}, {}, ConvertUserWithAdvicesSelectionFromProtoAction> {
  return wrapAsyncAction('CONVERT_PROTO', (): Promise<bayes.bob.UserWithAdviceSelection> =>
    convertUserWithAdviceSelectionFromProtoPost(proto))
}

type ConvertUserWithAdvicesSelectionToProtoAction = AsyncAction<'CONVERT_PROTO', string>

function convertUserWithAdviceSelectionToProto(proto: bayes.bob.UserWithAdviceSelection):
ThunkAction<Promise<string|void>, {}, {}, ConvertUserWithAdvicesSelectionToProtoAction> {
  return wrapAsyncAction('CONVERT_PROTO', (): Promise<string> =>
    convertUserWithAdviceSelectionToProtoPost(proto))
}

type DiagnoseProjectAction = AsyncAction<'DIAGNOSE_PROJECT', bayes.bob.Diagnostic>

function diagnoseProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Diagnostic|void>, {}, {}, DiagnoseProjectAction> {
  return wrapAsyncAction(
    'DIAGNOSE_PROJECT', (): Promise<bayes.bob.Diagnostic> => projectDiagnosePost(user))
}

type SimulateFocusEmailsAction = AsyncAction<'SIMULATE_FOCUS_EMAILS', bayes.bob.User>

function simulateFocusEmails(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.User|void>, {}, {}, SimulateFocusEmailsAction> {
  return wrapAsyncAction(
    'SIMULATE_FOCUS_EMAILS', (): Promise<bayes.bob.User> => simulateFocusEmailsPost(user))
}

type StrategizeProjectAction = AsyncAction<'STRATEGIZE_PROJECT', bayes.bob.Strategies>

function strategizeProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Strategies|void>, {}, {}, StrategizeProjectAction> {
  return wrapAsyncAction(
    'STRATEGIZE_PROJECT', (): Promise<bayes.bob.Strategies> => projectStrategizePost(user))
}

export type GetAdviceTipsAction =
AsyncAction<'GET_ADVICE_TIPS', readonly bayes.bob.Action[]> & {
  advice: bayes.bob.Advice
  project: bayes.bob.Project
}

function ensureAuth<T>(auth?: T): T {
  if (!auth) {
    throw new Error("L'authentification de la connexion a été perdue")
  }
  return auth
}

function getAdviceTips(project: bayes.bob.Project, advice: bayes.bob.Advice):
ThunkAction<Promise<readonly bayes.bob.Action[]|void>, RootState, {}, GetAdviceTipsAction> {
  return (dispatch: DispatchAllActions, getState: () => RootState):
  Promise<readonly bayes.bob.Action[]|void> => {
    const {user, app} = getState()
    return dispatch(wrapAsyncAction(
      'GET_ADVICE_TIPS',
      (): Promise<readonly bayes.bob.Action[]> =>
        adviceTipsGet(user, project, advice, ensureAuth(app.authToken)),
      {advice, project}))
  }
}

type GetExpandedCardContentAction = AsyncAction<'GET_EXPANDED_CARD_CONTENT', {}> & {
  advice: bayes.bob.Advice
  project: bayes.bob.Project
}

function getExpandedCardContent(project: bayes.bob.Project, adviceId: string, fetchKey?: string):
ThunkAction<Promise<{}|void>, RootState, {}, GetExpandedCardContentAction> {
  return (dispatch: DispatchAllActions, getState: () => RootState): Promise<{}|void> => {
    const {user, app} = getState()
    return dispatch(
      wrapAsyncAction(
        'GET_EXPANDED_CARD_CONTENT',
        (): Promise<{}> => expandedCardContentGet(user, project, {adviceId}, app.authToken),
        {advice: {adviceId}, project},
        fetchKey,
      ),
    )
  }
}

type GetJobAction = AsyncAction<'GET_JOBS', bayes.bob.JobGroup> & {
  romeId: string
}

export type RomeJobGroup = bayes.bob.JobGroup & {romeId: string}

function getJobs({romeId}: RomeJobGroup):
ThunkAction<Promise<bayes.bob.JobGroup|void>, {}, {}, GetJobAction> {
  return (dispatch: DispatchAllActions): Promise<bayes.bob.JobGroup|void> => {
    return dispatch(wrapAsyncAction(
      'GET_JOBS', (): Promise<bayes.bob.JobGroup> => jobsGet(romeId), {romeId}))
  }
}

type GetApplicationModesAction = AsyncAction<'GET_APPLICATION_MODES', bayes.bob.JobGroup> & {
  romeId: string
}

function fetchApplicationModes({romeId}: RomeJobGroup):
ThunkAction<Promise<bayes.bob.JobGroup|void>, {}, {}, GetApplicationModesAction> {
  return (dispatch: DispatchAllActions): Promise<bayes.bob.JobGroup|void> => {
    return dispatch(wrapAsyncAction(
      'GET_APPLICATION_MODES',
      (): Promise<bayes.bob.JobGroup> => applicationModesGet(romeId),
      {romeId}))
  }
}

type GetProjectRequirementsAction =
  AsyncAction<'GET_PROJECT_REQUIREMENTS', bayes.bob.JobRequirements> &
  {project: bayes.bob.Project}

type ProjectWithTargetJobGroup = bayes.bob.Project & {
  targetJob: {jobGroup: RomeJobGroup}
}

function fetchProjectRequirements(project: ProjectWithTargetJobGroup):
ThunkAction<Promise<bayes.bob.JobRequirements|void>, {}, {}, GetProjectRequirementsAction> {
  const {targetJob: {jobGroup: {romeId}}} = project
  return wrapAsyncAction(
    'GET_PROJECT_REQUIREMENTS',
    (): Promise<bayes.bob.JobRequirements> => jobRequirementsGet(romeId),
    {project},
  )
}

type DeleteUserAction = AsyncAction<'DELETE_USER_DATA', bayes.bob.User>

function deleteUser(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, DeleteUserAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {app} = getState()
    return dispatch(wrapAsyncAction(
      'DELETE_USER_DATA', (): Promise<bayes.bob.User> =>
        userDelete(user, ensureAuth(app.authToken))))
  }
}

export type GetUserDataAction = AsyncAction<'GET_USER_DATA', bayes.bob.User>

function fetchUser(userId: string, ignoreFailure: boolean):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, GetUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {authToken} = getState().app
    return dispatch(
      wrapAsyncAction(
        'GET_USER_DATA',
        (): Promise<bayes.bob.User> => markUsedAndRetrievePost(userId, ensureAuth(authToken)),
        {ignoreFailure}))
  }
}

type PostUserDataAction = AsyncAction<'POST_USER_DATA', bayes.bob.User>

function saveUser(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, PostUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {authToken, initialUtm} = getState().app
    // TODO(cyrille): Remove if this is redundant with user_reducer.
    const trackedUser = user.origin ? user : {
      ...user,
      origin: initialUtm || undefined,
    }
    return dispatch(wrapAsyncAction(
      'POST_USER_DATA', (): Promise<bayes.bob.User> =>
        userPost(trackedUser, ensureAuth(authToken))))
  }
}

export type DiagnoseOnboardingAction =
  AsyncAction<'DIAGNOSE_ONBOARDING', bayes.bob.QuickDiagnostic> & {
    readonly user: bayes.bob.User
  }

function diagnoseOnboarding(userDiff: bayes.bob.User):
ThunkAction<Promise<bayes.bob.QuickDiagnostic|void>, RootState, {}, DiagnoseOnboardingAction> {
  return (dispatch, getState): Promise<bayes.bob.QuickDiagnostic|void> => {
    const {app: {authToken}, user: {userId}} = getState()
    const completeUserDiff = {
      ...userDiff,
      // Make an empty incomplete project if there's none.
      projects: userDiff.projects ? userDiff.projects.map((project, index): bayes.bob.Project =>
        index ? project : {...project, isIncomplete: true}) : userDiff.projects,
      userId,
    }
    const fieldMask = getDefinedFieldsPath(userDiff).join(',')
    return dispatch(wrapAsyncAction(
      'DIAGNOSE_ONBOARDING',
      (): Promise<bayes.bob.QuickDiagnostic> =>
        onboardingDiagnosePost({fieldMask, user: completeUserDiff}, ensureAuth(authToken)),
      {user: completeUserDiff}))
  }
}

type ActivateDemoAction = Readonly<Action<'ACTIVATE_DEMO'>> & {demo: string}

function activateDemo(demo: string):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, ActivateDemoAction | PostUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    dispatch({demo, type: 'ACTIVATE_DEMO'})
    return dispatch(saveUser(getState().user))
  }
}

interface ProjectExtra {
  project: bayes.bob.Project
  projectDiff: bayes.bob.Project
}

function updateProject
<T extends string, E, A extends AsyncAction<T, bayes.bob.Project> & ProjectExtra & E>(
  type: T, project: bayes.bob.Project, projectDiff: bayes.bob.Project, options?: E):
  ThunkAction<Promise<bayes.bob.Project|void>, RootState, {}, A> {
  return (dispatch, getState): Promise<bayes.bob.Project|void> => {
    const {app: {authToken}, user} = getState()
    return dispatch(wrapAsyncAction(
      type,
      (): Promise<bayes.bob.Project> => {
        if (user.userId) {
          return projectPost(user, project, projectDiff, ensureAuth(authToken))
        }
        return Promise.resolve({...project, ...projectDiff})
      },
      {project, projectDiff, ...options},
    ))
  }
}

interface AdviceExtra {
  advice: bayes.bob.Advice
  adviceDiff: bayes.bob.Advice
  project: bayes.bob.Project
}

function updateAdvice<
  T extends string, E, A extends AsyncAction<T, bayes.bob.Advice> & AdviceExtra & E>(
  type: T, project: bayes.bob.Project, advice: bayes.bob.Advice, adviceDiff: bayes.bob.Advice,
  options?: E):
  ThunkAction<Promise<bayes.bob.Advice|void>, RootState, {}, A> {
  return (dispatch, getState): Promise<bayes.bob.Advice|void> => {
    const {app: {authToken}, user} = getState()
    return dispatch(wrapAsyncAction(
      type,
      (): Promise<bayes.bob.Advice> => {
        if (user.userId) {
          return advicePost(user, project, advice, adviceDiff, ensureAuth(authToken))
        }
        return Promise.resolve({...advice, ...adviceDiff})
      },
      {advice, adviceDiff, project, ...options},
    ))
  }
}

type AsyncUpdateAdviceAction<T extends string> = AsyncAction<T, bayes.bob.Advice> & AdviceExtra
type AdvicePageIsShownAction = AsyncUpdateAdviceAction<'ADVICE_PAGE_IS_SHOWN'>

function advicePageIsShown(project: bayes.bob.Project, advice: bayes.bob.Advice):
ThunkAction<Promise<bayes.bob.Advice|void>, RootState, {}, AdvicePageIsShownAction> {
  return updateAdvice('ADVICE_PAGE_IS_SHOWN', project, advice, {status: 'ADVICE_READ'})
}

type DiagnosticIsShownAction =
  AsyncAction<'DIAGNOSTIC_IS_SHOWN', bayes.bob.Project> & ProjectExtra

function diagnosticIsShown(project: bayes.bob.Project):
ThunkAction<Promise<bayes.bob.Project|void>, RootState, {}, DiagnosticIsShownAction> |
Action<'DIAGNOSTIC_IS_SHOWN'> {
  if (project && project.diagnosticShownAt) {
    return {type: 'DIAGNOSTIC_IS_SHOWN'}
  }
  const now = new Date()
  now.setMilliseconds(0)
  return updateProject('DIAGNOSTIC_IS_SHOWN', project, {diagnosticShownAt: now.toISOString()})
}

type ExploreAdviceAction =
  AsyncUpdateAdviceAction<'EXPLORE_ADVICE'> & VisualElementAction<'EXPLORE_ADVICE'>

function exploreAdvice(project: bayes.bob.Project, advice: bayes.bob.Advice, visualElement: string):
ThunkAction<
Promise<bayes.bob.Advice|void>, RootState, {}, ExploreAdviceAction> {
  return updateAdvice(
    'EXPLORE_ADVICE', project, advice,
    {numExplorations: (advice.numExplorations || 0) + 1},
    {visualElement})
}

export interface WithFeedback {
  feedback: bayes.bob.Feedback
}

interface StateForFeedback {
  app: AppState
  user: bayes.bob.User
}

function sendFeedback<T extends string, A extends AsyncAction<T, string> & WithFeedback>(
  type: T, source: bayes.bob.FeedbackSource, feedback: bayes.bob.Feedback,
  extraFields?: Omit<bayes.bob.Feedback, 'source' | 'feedback' | 'userId'>):
  ThunkAction<Promise<{}|void>, StateForFeedback, {}, A> {
  return (dispatch: DispatchAllActions, getState): Promise<{}|void> => {
    const {user, app} = getState()
    return dispatch(wrapAsyncAction<T, WithFeedback, {}, A>(
      type,
      (): Promise<{}> => feedbackPost({
        ...feedback,
        source,
        userId: user.userId,
        ...extraFields,
      }, ensureAuth(app.authToken)),
      {feedback},
    )).then((response: {}|void): {}|void => {
      if (response) {
        dispatch(displayToasterMessage('Merci pour ce retour'))
      }
      return response
    })
  }
}


type SendAdviceFeedbackAction = AsyncAction<'SEND_ADVICE_FEEDBACK', {}> & WithFeedback

function sendAdviceFeedback(
  {projectId}: bayes.bob.Project = {}, {adviceId}: bayes.bob.Advice = {},
  feedback: bayes.bob.Feedback, score = 0):
  ThunkAction<Promise<{}|void>, StateForFeedback, {}, SendAdviceFeedbackAction> {
  return sendFeedback(
    'SEND_ADVICE_FEEDBACK', 'ADVICE_FEEDBACK', feedback, {adviceId, projectId, score})
}

type SendProfessionalFeedbackAction =
  AsyncAction<'SEND_PROFESSIONAL_FEEDBACK', {}> & WithFeedback

function sendProfessionalFeedback(feedback: bayes.bob.Feedback):
ThunkAction<Promise<{}|void>, StateForFeedback, {}, SendProfessionalFeedbackAction> {
  return sendFeedback('SEND_PROFESSIONAL_FEEDBACK', 'PROFESSIONAL_PAGE_FEEDBACK', feedback)
}

type SendProjectFeedbackAction =
  AsyncAction<'SEND_PROJECT_FEEDBACK', bayes.bob.Project> & WithFeedback & {
    readonly project: bayes.bob.Project
    readonly projectDiff: bayes.bob.Project
  }

function sendProjectFeedback(project: bayes.bob.Project, feedback: bayes.bob.ProjectFeedback):
ThunkAction<Promise<bayes.bob.Project|void>, StateForFeedback, {}, SendProjectFeedbackAction> {
  return (dispatch: DispatchAllActions): Promise<bayes.bob.Project|void> => {
    return dispatch(updateProject('SEND_PROJECT_FEEDBACK', project, {feedback})).
      then((response: bayes.bob.Project|void): bayes.bob.Project|void => {
        if (response) {
          dispatch(displayToasterMessage('Merci pour ce retour !'))
        }
        return response
      })
  }
}

type SendChangelogFeedbackAction =
  AsyncAction<'SEND_CHANGELOG_FEEDBACK', {}> & WithFeedback

function sendChangelogFeedback(feedback: bayes.bob.Feedback):
ThunkAction<Promise<{}|void>, StateForFeedback, {}, SendChangelogFeedbackAction> {
  return sendFeedback('SEND_CHANGELOG_FEEDBACK', 'CHANGELOG_FEEDBACK', feedback)
}

export type ReplaceStrategyAction =
AsyncAction<'REPLACE_STRATEGY', bayes.bob.WorkingStrategy> & {
  readonly project: bayes.bob.Project
  readonly strategy: bayes.bob.WorkingStrategy
}

function replaceStrategy(project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy):
ThunkAction<Promise<bayes.bob.WorkingStrategy|void>, RootState, {}, ReplaceStrategyAction> {
  return (dispatch, getState): Promise<bayes.bob.WorkingStrategy|void> => {
    const {app: {authToken}, user} = getState()
    return dispatch(wrapAsyncAction(
      'REPLACE_STRATEGY',
      (): Promise<bayes.bob.WorkingStrategy> => {
        if (user.userId) {
          return strategyPost(user, project, strategy, ensureAuth(authToken))
        }
        return Promise.resolve(strategy)
      },
      {project, strategy},
    ))
  }
}

type StopStrategyAction = AsyncAction<'STOP_STRATEGY', string> & {
  readonly project: bayes.bob.Project
  readonly strategy: bayes.bob.WorkingStrategy
}

function stopStrategy(
  project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy,
): ThunkAction<Promise<string|void>, RootState, {}, StopStrategyAction> {
  return (dispatch, getState): Promise<string|void> => {
    const {app: {authToken}, user} = getState()
    return dispatch(wrapAsyncAction(
      'STOP_STRATEGY',
      (): Promise<string> => {
        if (user.userId) {
          return strategyDelete(user, project, strategy, ensureAuth(authToken))
        }
        return Promise.resolve('OK')
      },
      {project, strategy},
    ))
  }
}

type AuthenticationMethod =
  | 'facebook'
  | 'google'
  | 'guest'
  | 'linkedIn'
  | 'password'
  | 'peConnect'

export type AuthenticateUserAction =
  AsyncAction<'AUTHENTICATE_USER', bayes.bob.AuthResponse> & {
    method: AuthenticationMethod
  }

// Export is for test purposes only.
export function asyncAuthenticate(
  authenticate: (request: bayes.bob.AuthRequest) => Promise<bayes.bob.AuthResponse>,
  authRequest: bayes.bob.AuthRequest,
  method: AuthenticationMethod,
  disconnectOnError?: boolean,
  callback?: (response: bayes.bob.AuthResponse) => bayes.bob.AuthResponse):
  ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AllActions> {
  return (dispatch, getState): Promise<bayes.bob.AuthResponse|void> => {
    const {app: {authToken, initialFeatures}, user: {hasAccount, hasPassword, userId}} = getState()
    const finalAuthRequest = {
      ...authRequest,
      ...initialFeatures ? {userData: {...initialFeatures, ...authRequest.userData}} : {},
      ...userId &&
        (!hasAccount || method === 'password' && !hasPassword) &&
        !authRequest.authToken ? {authToken, userId} : {},
    }
    return dispatch(wrapAsyncAction(
      'AUTHENTICATE_USER',
      (): Promise<bayes.bob.AuthResponse> => authenticate(finalAuthRequest).then(callback),
      {method},
    )).then((authResponse): bayes.bob.AuthResponse|void => {
      if (disconnectOnError && !authResponse) {
        // There was an error while connecting, return to a clean authentication state.
        // TODO(cyrille): Handle the case where there's a response with an invalid body.
        dispatch(removeAuthData)
      }
      if (authResponse && authResponse.isServerError) {
        return
      }
      return authResponse
    })
  }
}

interface MockApi {
  userAuthenticate: typeof userAuthenticate
}

function facebookAuthenticateUser(facebookAuth: ReactFacebookLoginInfo, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  // The facebookAuth object contains:
  //  - the email address: email
  //  - the facebook user ID: userID
  //  - the full name: name
  //  - the URL of a profile picture: picture.data.url
  //  - the user's gender: gender
  //  - the user's birth day: birthday
  return asyncAuthenticate(authenticate, {
    facebookAccessToken: facebookAuth.accessToken,
  }, 'facebook', false)
}


function googleAuthenticateUser(
  googleAuth: GoogleLoginResponse, mockApi?: MockApi,
): ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {
    googleTokenId: googleAuth.getAuthResponse().id_token,
  }, 'google', false, (authResponse: bayes.bob.AuthResponse): bayes.bob.AuthResponse => {
    // The signed request sent to the server only contains some fields. If it
    // is verified we trust the full googleAuth object and add non-signed
    // fields that we need.
    const profile = googleAuth.getBasicProfile()
    if (!authResponse || !authResponse.authenticatedUser ||
        profile.getId() !== authResponse.authenticatedUser.googleId) {
      return authResponse
    }
    const {lastName = '', name = ''} = authResponse.authenticatedUser.profile || {}
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

function peConnectAuthenticateUser(code: string, nonce: string, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {
    peConnectCode: code,
    peConnectNonce: nonce,
  }, 'peConnect')
}

function linkedInAuthenticateUser(code: string, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {linkedInCode: code}, 'linkedIn')
}

type EmailCheckAction = AsyncAction<'EMAIL_CHECK', bayes.bob.AuthResponse> & {method: string}

function emailCheck(email: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, {}, {}, EmailCheckAction> {
  return wrapAsyncAction(
    'EMAIL_CHECK',
    (): Promise<bayes.bob.AuthResponse> => userAuthenticate({email}),
    {method: 'password'})
}

type ChangePasswordAction =
  AsyncAction<'CHANGE_PASSWORD', bayes.bob.AuthResponse> & {method: string}

function changePassword(email: string, oldPassword: string, hashSalt: string, password: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, {}, {}, ChangePasswordAction> {
  const cleanEmail = email.trim()
  return wrapAsyncAction(
    'CHANGE_PASSWORD',
    (): Promise<bayes.bob.AuthResponse> => userAuthenticate({
      email,
      hashSalt,
      hashedPassword: sha1(hashSalt + sha1(cleanEmail + oldPassword)),
      newHashedPassword: sha1(cleanEmail + password),
    }),
    {method: 'password'})
}

function registerNewUser(email: string, password: string, firstName: string, lastName: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const cleanEmail = email.trim()
  return asyncAuthenticate(userAuthenticate, {
    email: cleanEmail,
    firstName: upperFirstLetter(firstName.trim()),
    hashedPassword: sha1(cleanEmail + password),
    lastName: upperFirstLetter(lastName.trim()),
  }, 'password')
}

function silentlyRegisterUser(email: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const cleanEmail = email.trim()
  return asyncAuthenticate(userAuthenticate, {email: cleanEmail}, 'password')
}

function registerNewGuestUser(firstName: string, userData?: bayes.bob.AuthUserData):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  return asyncAuthenticate(userAuthenticate, {
    firstName: upperFirstLetter(firstName.trim()),
    userData,
  }, 'guest', true)
}

function loginUser(email: string, password: string, hashSalt: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const cleanEmail = email.trim()
  return asyncAuthenticate(userAuthenticate, {
    email: cleanEmail,
    hashSalt,
    hashedPassword: sha1(hashSalt + sha1(cleanEmail + password)),
  }, 'password')
}

function loginUserFromToken(userId: string, authToken: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, {}, {}, AuthenticateUserAction> {
  return wrapAsyncAction(
    'AUTHENTICATE_USER',
    (): Promise<bayes.bob.AuthResponse> => userAuthenticate({authToken, userId}))
}

type CreateSupportTicketAction = AsyncAction<'CREATE_SUPPORT_TICKET', bayes.bob.SupportTicket>

// TODO(cyrille): Update the local user state to avoid overriding it on global user save.
function createSupportTicket(ticketId: string):
ThunkAction<Promise<{}|void>, RootState, {}, CreateSupportTicketAction> {
  return (dispatch, getState): Promise<{}|void> => {
    const {app: {authToken}, user: {userId}} = getState()
    return dispatch(wrapAsyncAction('CREATE_SUPPORT_TICKET', (): Promise<{}> =>
      supportTicketPost(ensureAuth(userId), ensureAuth(authToken), ticketId)))
  }
}

interface MarkChangelogAsSeenAction extends Readonly<Action<'MARK_CHANGELOG_AS_SEEN'>> {
  readonly changelog: string
}

function markChangelogAsSeen(changelog: string):
ThunkAction<
Promise<bayes.bob.User|void>, RootState, {}, MarkChangelogAsSeenAction | PostUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    dispatch({changelog, type: 'MARK_CHANGELOG_AS_SEEN'})
    return dispatch(saveUser(getState().user))
  }
}

type MigrateUserToAdviceAction = AsyncAction<'MIGRATE_USER_TO_ADVISOR', bayes.bob.User>

function migrateUserToAdvisor():
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, MigrateUserToAdviceAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {authToken} = getState().app
    return dispatch(wrapAsyncAction(
      'MIGRATE_USER_TO_ADVISOR',
      (): Promise<bayes.bob.User> => migrateUserToAdvisorPost(
        getState().user, ensureAuth(authToken))))
  }
}

export type PageIsLoadedAction = Readonly<Action<'PAGE_IS_LOADED'>> & {
  readonly location: {
    readonly pathname: string
  }
  readonly timeToFirstInteractiveMillisecs?: number
}

function pageIsLoaded(location: {readonly pathname: string}):
ThunkAction<PageIsLoadedAction, RootState, {}, PageIsLoadedAction> {
  return (dispatch, getState): PageIsLoadedAction => {
    const {app: {hasLoadedApp}} = getState()
    return dispatch({
      location: location || window.location,
      // TODO (cyrille): Maybe sample this measurement if we don't want to slow down everyone.
      ...!hasLoadedApp && window.performance && window.performance.now && {
        timeToFirstInteractiveMillisecs: window.performance.now(),
      },
      type: 'PAGE_IS_LOADED',
    })
  }
}

function resetPassword(email: string, password: string, authToken: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, {}, {}, AuthenticateUserAction> {
  const cleanEmail = email.trim()
  return wrapAsyncAction(
    'AUTHENTICATE_USER', (): Promise<bayes.bob.AuthResponse> => userAuthenticate({
      authToken, email: cleanEmail, hashedPassword: sha1(cleanEmail + password)}))
}


interface ProfileAction<T extends string> extends Readonly<Action<T>> {
  userProfile: bayes.bob.UserProfile
}

type AcceptPrivacyNoticeAction = ProfileAction<'ACCEPT_PRIVACY_NOTICE'>
type FinishProfileFrustrationsAction = ProfileAction<'FINISH_PROFILE_FRUSTRATIONS'>
type FinishProfileSettingsAction = ProfileAction<'FINISH_PROFILE_SETTINGS'>
type FinishProfileSituationAction = ProfileAction<'FINISH_PROFILE_SITUATION'>
type SetUserProfileAction = ProfileAction<'SET_USER_PROFILE'>

function setUserProfile(
  userProfile: bayes.bob.UserProfile, shouldAlsoSaveUser: boolean, type?: undefined):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, SetUserProfileAction>
function setUserProfile<T extends string>(
  userProfile: bayes.bob.UserProfile, shouldAlsoSaveUser: boolean, type: T):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, ProfileAction<T>>
function setUserProfile<T extends string>(
  userProfile: bayes.bob.UserProfile, shouldAlsoSaveUser: boolean, type?: T):
  ThunkAction<
  Promise<bayes.bob.User|void>, RootState, {}, ProfileAction<T | 'SET_USER_PROFILE'>> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    // Drop unknown kinds.
    // TODO(pascal): Check that gender, situation, jobSearchPhase
    // are consistent with their kinds, if they exist.
    dispatch({type: type || 'SET_USER_PROFILE', userProfile})
    const {user} = getState()
    if (shouldAlsoSaveUser) {
      return dispatch(saveUser(user))
    }
    return Promise.resolve(user)
  }
}

type CreateProjectAction = ProjectAction<'CREATE_PROJECT'>
type FinishProjectCriteriaAction = ProjectAction<'FINISH_PROJECT_CRITERIA'>
type FinishProjectGoalAction = ProjectAction<'FINISH_PROJECT_GOAL'>
type FinishProjectExperienceAction = ProjectAction<'FINISH_PROJECT_EXPERIENCE'>
type EditFirstProjectAction = ProjectAction<'EDIT_FIRST_PROJECT'>
type ModifyProjectAction = ProjectAction<'MODIFY_PROJECT'>

function editFirstProject(newProjectData: bayes.bob.Project, t: TFunction, actionType?: undefined):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, EditFirstProjectAction>
function editFirstProject<T extends string>(
  newProjectData: bayes.bob.Project, t: TFunction, actionType?: T):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, ProjectAction<T>>
function editFirstProject<T extends string>(
  newProjectData: bayes.bob.Project, t: TFunction, actionType?: T):
  ThunkAction<
  Promise<bayes.bob.User|void>, RootState, {}, ProjectAction<T | 'EDIT_FIRST_PROJECT'>> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {user} = getState()
    const project = newProject(newProjectData, t, user.profile && user.profile.gender || undefined)
    dispatch({project, type: actionType || 'EDIT_FIRST_PROJECT'})
    return dispatch(saveUser(getState().user))
  }
}

type CreateProjectSaveAction = AsyncAction<'CREATE_PROJECT_SAVE', bayes.bob.User>

export interface RootState {
  app: AppState
  asyncState: AsyncState<AllActions>
  user: bayes.bob.User
}

function createFirstProject():
ThunkAction<
Promise<bayes.bob.User|void>, RootState, {}, CreateProjectAction | CreateProjectSaveAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {app: {authToken}, user: {projects: [project = {}] = []}} = getState()
    dispatch({project, type: 'CREATE_PROJECT'})
    // Don't use normal saveUser to be able to distinguish between project creation and user saving.
    return dispatch(wrapAsyncAction(
      'CREATE_PROJECT_SAVE',
      (): Promise<bayes.bob.User> => userPost(getState().user, ensureAuth(authToken))))
  }
}

type ResetUserPasswordAction = AsyncAction<'RESET_USER_PASSWORD', {}>

function askPasswordReset(email: string):
ThunkAction<Promise<{}|void>, {}, {}, ResetUserPasswordAction> {
  return wrapAsyncAction('RESET_USER_PASSWORD', (): Promise<{}> => resetPasswordPost(email))
}

function silentlySetupCoaching(email: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  return (dispatch, getState): Promise<bayes.bob.AuthResponse|void> => {
    return dispatch(silentlyRegisterUser(email)).then(
      (authResponse): bayes.bob.AuthResponse|void|Promise<bayes.bob.AuthResponse|void> => {
        if (!authResponse) {
          return authResponse
        }
        const {user: {profile: {coachingEmailFrequency = undefined} = {}}} = getState()
        if (coachingEmailFrequency && coachingEmailFrequency !== 'EMAIL_NONE') {
          return authResponse
        }
        return dispatch(setUserProfile({coachingEmailFrequency: 'EMAIL_MAXIMUM'}, true)).then(
          (response) => {
            if (response) {
              return authResponse
            }
          },
        )
      },
    )
  }
}

export interface AuthEvalState {
  fetchGoogleIdToken?: () => Promise<string>
}


export interface EvalRootState {
  asyncState: AsyncState<AllEvalActions>
  auth: AuthEvalState
}

type EvalFiltersUseCasesAction =
  AsyncAction<'GET_EVAL_FILTERS_USE_CASES', readonly bayes.bob.UseCase[]>

function getEvalFiltersUseCases(filters: readonly string[]):
ThunkAction<Promise<readonly bayes.bob.UseCase[]|void>, EvalRootState, {},
EvalFiltersUseCasesAction> {
  return (dispatch, getState): Promise<readonly bayes.bob.UseCase[]|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      'GET_EVAL_FILTERS_USE_CASES',
      (): Promise<readonly bayes.bob.UseCase[]> => ensureAuth(fetchGoogleIdToken)().
        then((googleIdToken: string): Promise<readonly bayes.bob.UseCase[]> =>
          evalFiltersUseCasesPost(filters, googleIdToken))))
  }
}

type GetEvalUseCasePoolsAction =
  AsyncAction<'GET_EVAL_USE_CASE_POOLS', readonly bayes.bob.UseCasePool[]>

function getEvalUseCasePools():
ThunkAction<Promise<readonly bayes.bob.UseCasePool[]|void>, EvalRootState, {},
GetEvalUseCasePoolsAction> {
  return (dispatch, getState): Promise<readonly bayes.bob.UseCasePool[]|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      'GET_EVAL_USE_CASE_POOLS', (): Promise<readonly bayes.bob.UseCasePool[]> =>
        ensureAuth(fetchGoogleIdToken)().
          then((googleIdToken: string): Promise<readonly bayes.bob.UseCasePool[] > =>
            evalUseCasePoolsGet(googleIdToken))))
  }
}

type GetEvalUseCasesAction = AsyncAction<'GET_EVAL_USE_CASES', readonly bayes.bob.UseCase[]>

function getEvalUseCases(poolName: string):
ThunkAction<Promise<readonly bayes.bob.UseCase[]|void>, EvalRootState, {}, GetEvalUseCasesAction> {
  return (dispatch, getState): Promise<readonly bayes.bob.UseCase[]|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      'GET_EVAL_USE_CASES', (): Promise<readonly bayes.bob.UseCase[]> =>
        ensureAuth(ensureAuth(fetchGoogleIdToken)()).
          then((googleIdToken: string): Promise<readonly bayes.bob.UseCase[]> =>
            evalUseCasesGet(poolName, googleIdToken))))
  }
}

type GetUseCaseDistributionAction =
  AsyncAction<'GET_USE_CASE_DISTRIBUTION', bayes.bob.UseCaseDistribution>

function getUseCaseDistribution(
  categories: readonly bayes.bob.DiagnosticCategory[] = [], maxUseCases: number):
  ThunkAction<
  Promise<bayes.bob.UseCaseDistribution|void>, EvalRootState, {}, GetUseCaseDistributionAction> {
  return (dispatch, getState): Promise<bayes.bob.UseCaseDistribution|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      'GET_USE_CASE_DISTRIBUTION',
      (): Promise<bayes.bob.UseCaseDistribution> => ensureAuth(fetchGoogleIdToken)().
        then((googleIdToken: string): Promise<bayes.bob.UseCaseDistribution> =>
          useCaseDistributionPost({categories, maxUseCases}, googleIdToken))))
  }
}

type GetAllCategoriesAction = AsyncAction<'GET_ALL_CATEGORIES', bayes.bob.DiagnosticCategories>

function getAllCategories(useCase: bayes.bob.UseCase):
ThunkAction<
Promise<bayes.bob.DiagnosticCategories|void>, EvalRootState, {}, GetAllCategoriesAction> {
  return (dispatch, getState): Promise<bayes.bob.UseCaseDistribution|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      'GET_ALL_CATEGORIES',
      (): Promise<bayes.bob.DiagnosticCategories> => ensureAuth(fetchGoogleIdToken)().
        then((googleIdToken: string): Promise<bayes.bob.DiagnosticCategories> =>
          getAllCategoriesPost(useCase, googleIdToken))))
  }
}

type CreateUseCaseAction = AsyncAction<'CREATE_USE_CASE', bayes.bob.UseCase>

function createUseCase(request: bayes.bob.UseCaseCreateRequest):
ThunkAction<
Promise<bayes.bob.UseCase|void>, EvalRootState, {}, CreateUseCaseAction> {
  return (dispatch, getState): Promise<bayes.bob.UseCase|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      'CREATE_USE_CASE',
      (): Promise<bayes.bob.UseCase> => ensureAuth(fetchGoogleIdToken)().
        then((googleIdToken: string): Promise<bayes.bob.UseCase> =>
          createEvalUseCasePost(request, googleIdToken))))
  }
}

type GetLocalStatsAction = AsyncAction<'GET_LOCAL_STATS', bayes.bob.LaborStatsData> &
ProjectAction<'GET_LOCAL_STATS'>

function getLaborStats(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, {}, {}, GetLocalStatsAction> {
  return wrapAsyncAction(
    'GET_LOCAL_STATS', (): Promise<bayes.bob.LaborStatsData> => projectLaborStatsPost(user),
    {project: (user.projects || [])[0] || {}})
}

function getCurrentUserLaborStats():
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, RootState, {}, GetLocalStatsAction> {
  return (dispatch, getState): Promise<bayes.bob.LaborStatsData|void> => {
    const {user} = getState()
    return dispatch(wrapAsyncAction(
      'GET_LOCAL_STATS', (): Promise<bayes.bob.LaborStatsData> => projectLaborStatsPost(user),
      {project: (user.projects || [])[0] || {}}))
  }
}

// Type of the main dispatch function.
export type DispatchAllActions =
  // Add actions as required.
  ThunkDispatch<RootState, {}, ActivateDemoAction> &
  ThunkDispatch<RootState, {}, DiagnosticIsShownAction> &
  ThunkDispatch<RootState, {}, ExploreAdviceAction> &
  ThunkDispatch<RootState, {}, GetUserDataAction> &
  ThunkDispatch<RootState, {}, MigrateUserToAdviceAction> &
  ThunkDispatch<RootState, {}, OpenLoginModalAction> &
  ThunkDispatch<RootState, {}, PageIsLoadedAction> &
  ThunkDispatch<RootState, {}, SendProjectFeedbackAction> &
  Dispatch<AllActions>

export type AllActions =
  | AcceptCookiesUsageAction
  | AcceptPrivacyNoticeAction
  | ActivateDemoAction
  | ActivateDemoInFutureAction
  | AdviceCardIsShownAction
  | AdvicePageIsShownAction
  | AsyncStartedAction
  | AuthenticateUserAction
  | ChangePasswordAction
  | ChangeSubmetricExpansionAction
  | ClearExpiredTokenAction
  | CloseLoginModalAction
  | CommentIsShown
  | CreateProjectAction
  | CreateProjectSaveAction
  | DeleteUserAction
  | DiagnoseOnboardingAction
  | DiagnosticIsShownAction
  | DiagnosticTalkIsShownAction
  | DisplayToastMessageAction
  | DownloadDiagnosticPdfAction
  | EditFirstProjectAction
  | EmailCheckAction
  | ExploreAdviceAction
  | FinishProfileFrustrationsAction
  | FinishProfileSettingsAction
  | FinishProfileSituationAction
  | FinishProjectCriteriaAction
  | FinishProjectExperienceAction
  | FinishProjectGoalAction
  | FollowJobOffersLinkAction
  | GetAdviceTipsAction
  | GetApplicationModesAction
  | GetExpandedCardContentAction
  | GetJobAction
  | GetProjectRequirementsAction
  | CreateSupportTicketAction
  | GetUserDataAction
  | HideToasterMessageAction
  | LandingPageSectionIsShownAction
  | LoadLandingPageAction
  | LogoutAction
  | MarkChangelogAsSeenAction
  | MigrateUserToAdviceAction
  | ModifyProjectAction
  | OnboardingCommentIsShownAction
  | OpenLoginModalAction
  | OpenRegistrationModalAction
  | OpenStatsPageAction
  | OpenTipExternalLinkAction
  | PageIsLoadedAction
  | PostUserDataAction
  | ReadTipAction
  | RemoveAuthDataAction
  | ReplaceStrategyAction
  | ResetUserPasswordAction
  | SeeAdviceAction
  | SendProjectFeedbackAction
  | SetUserProfileAction
  | ShareProductModalIsShownAction
  | ShareProductToNetworkAction
  | ShowAllTipsAction
  | StartAsGuestAction
  | StartStrategyAction
  | StaticAdvicePageIsShownAction
  | StatsPageIsShownAction
  | StopStrategyAction
  | StrategyExplorationPageIsShown
  | StrategyWorkPageIsShown
  | SwitchToMobileVersionAction
  | TrackInitialFeaturesAction
  | TrackInitialUtmAction
  | WorkbenchIsShownAction


// TODO(cyrille): Split eval actions in a separate file.


// Type of the eval dispatch function.
export type DispatchAllEvalActions =
  // Add actions as required.
  ThunkDispatch<EvalRootState, {}, ComputeAdvicesForProjectAction> &
  ThunkDispatch<EvalRootState, {}, DiagnoseProjectAction> &
  ThunkDispatch<EvalRootState, {}, CreateUseCaseAction> &
  ThunkDispatch<EvalRootState, {}, GetEvalUseCasesAction> &
  ThunkDispatch<EvalRootState, {}, GetEvalUseCasePoolsAction> &
  ThunkDispatch<EvalRootState, {}, GetLocalStatsAction> &
  ThunkDispatch<EvalRootState, {}, SimulateFocusEmailsAction> &
  ThunkDispatch<EvalRootState, {}, StrategizeProjectAction> &
  Dispatch<AllEvalActions>


type SelectEvalUserAction = Action<'SELECT_USER'> & {
  user: bayes.bob.User
}


type EvalAuthAction = Action<'AUTH'> & {
  googleUser: GoogleLoginResponse
}


export type AllEvalActions =
  | ComputeAdvicesForProjectAction
  | DiagnoseProjectAction
  | EvalAuthAction
  | EvalFiltersUseCasesAction
  | CreateUseCaseAction
  | GetEvalUseCasesAction
  | GetEvalUseCasePoolsAction
  | GetLocalStatsAction
  | GetUseCaseDistributionAction
  | HideToasterMessageAction
  | SelectEvalUserAction
  | SimulateFocusEmailsAction
  | StrategizeProjectAction


export type BootstrapAction =
  ComputeAdvicesForProjectAction |
  ConvertUserWithAdvicesSelectionToProtoAction |
  ConvertUserWithAdvicesSelectionFromProtoAction |
  DisplayToastMessageAction |
  SendAdviceFeedbackAction


export interface BootstrapState {
  app: AppState
  asyncState: AsyncState<BootstrapAction>
  user: bayes.bob.User
}


export type DispatchBootstrapActions =
  ThunkDispatch<{}, {}, ComputeAdvicesForProjectAction> &
  ThunkDispatch<{}, {}, ConvertUserWithAdvicesSelectionFromProtoAction> &
  ThunkDispatch<BootstrapState, {}, SendAdviceFeedbackAction> &
  (<T extends string, A extends Action<T>>(action: A) => A)


export const noOp = (): void => {
  // Do nothing.
}

export {saveUser, hideToasterMessageAction, setUserProfile, fetchUser, clearExpiredTokenAction,
  readTip, facebookAuthenticateUser, sendAdviceFeedback, modifyProject,
  googleAuthenticateUser, emailCheck, registerNewUser, loginUser, logoutAction,
  createFirstProject, fetchProjectRequirements, resetPassword, openStatsPageAction,
  editFirstProject, sendProfessionalFeedback, diagnoseProject, strategizeProject,
  displayToasterMessage, closeLoginModal, followJobOffersLinkAction,
  openLoginModal, acceptCookiesUsageAction, switchToMobileVersionAction,
  loadLandingPage, deleteUser, askPasswordReset, registerNewGuestUser,
  openTipExternalLink, advicePageIsShown, seeAdvice, markChangelogAsSeen,
  adviceCardIsShown, getAdviceTips, showAllTips, migrateUserToAdvisor, getJobs,
  shareProductToNetwork, trackInitialUtm, trackInitialFeatures,
  peConnectAuthenticateUser, sendProjectFeedback, createUseCase, createSupportTicket,
  sendChangelogFeedback, landingPageSectionIsShown, openRegistrationModal,
  computeAdvicesForProject, diagnosticTalkIsShown, getAllCategories,
  getEvalUseCasePools, getEvalUseCases, getExpandedCardContent,
  activateDemoInFuture, activateDemo, diagnosticIsShown, downloadDiagnosticAsPdf,
  loginUserFromToken, shareProductModalIsShown,
  staticAdvicePageIsShown, linkedInAuthenticateUser, pageIsLoaded,
  isActionRegister, workbenchIsShown, getEvalFiltersUseCases,
  exploreAdvice, diagnoseOnboarding, convertUserWithAdviceSelectionFromProto,
  convertUserWithAdviceSelectionToProto, replaceStrategy, fetchApplicationModes,
  changeSubmetricExpansion, getUseCaseDistribution, startStrategy, stopStrategy,
  strategyExplorationPageIsShown, strategyWorkPageIsShown, getLaborStats,
  startAsGuest, statsPageIsShown, changePassword, silentlyRegisterUser, getCurrentUserLaborStats,
  onboardingCommentIsShown, commentIsShown, simulateFocusEmails, silentlySetupCoaching,
}

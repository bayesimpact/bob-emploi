import {Action, Dispatch} from 'redux'
import {ThunkAction, ThunkDispatch} from 'redux-thunk'
import sha1 from 'sha1'

import {splitFullName} from 'store/auth'
import {upperFirstLetter} from 'store/french'
import {newProject} from 'store/project'

import {adviceTipsGet, evalUseCasePoolsGet, evalUseCasesGet, advicePost, projectPost,
  jobRequirementsGet, jobsGet, userDelete, markUsedAndRetrievePost, evalFiltersUseCasesPost,
  userPost, feedbackPost, userAuthenticate, resetPasswordPost, onboardingDiagnosePost,
  migrateUserToAdvisorPost, projectComputeAdvicesPost, expandedCardContentGet, strategyPost,
  projectDiagnosePost, convertUserWithAdviceSelectionFromProtoPost, useCaseDistributionPost,
  convertUserWithAdviceSelectionToProtoPost, projectStrategizePost, projectLaborStatsPost,
  getAllCategoriesPost, createEvalUseCasePost, applicationModesGet,
} from './api'

const ASYNC_MARKER = 'ASYNC_MARKER'

// User actions.

// TODO(pascal): Stop exporting those once we switch to Typescript. Typescript will check for typos
// (which was the original intention), and the export does not keep the type.

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
export const REPLACE_STRATEGY = 'REPLACE_STRATEGY'

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
export const GET_APPLICATION_MODES = 'GET_APPLICATION_MODES'
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
export const STRATEGIZE_PROJECT = 'STRATEGIZE_PROJECT'
export const GET_ALL_CATEGORIES = 'GET_ALL_CATEGORIES'
export const GET_EVAL_FILTERS_USE_CASES = 'GET_EVAL_FILTERS_USE_CASES'
export const GET_EVAL_USE_CASE_POOLS = 'GET_EVAL_USE_CASE_POOLS'
export const GET_EVAL_USE_CASES = 'GET_EVAL_USE_CASES'
export const GET_LOCAL_STATS = 'GET_LOCAL_STATS'
export const GET_USE_CASE_DISTRIBUTION = 'GET_USE_CASE_DISTRIBUTION'
export const GET_EXPANDED_CARD_CONTENT = 'GET_EXPANDED_CARD_CONTENT'
export const DOWNLOAD_DIAGNOSTIC_PDF = 'DOWNLOAD_DIAGNOSTIC_PDF'
export const WILL_ACTIVATE_DEMO = 'WILL_ACTIVATE_DEMO'
export const PRODUCT_UPDATED_PAGE_IS_SHOWN = 'PRODUCT_UPDATED_PAGE_IS_SHOWN'
export const PAGE_IS_LOADED = 'PAGE_IS_LOADED'
export const WORKBENCH_IS_SHOWN = 'WORKBENCH_IS_SHOWN'
export const CHANGE_SUBMETRIC_EXPANSION = 'CHANGE_SUBMETRIC_EXPANSION'
export const START_STRATEGY = 'START_STRATEGY'
export const STRATEGY_EXPLORATION_PAGE_IS_SHOWN = 'STRATEGY_EXPLORATION_PAGE_IS_SHOWN'
export const STRATEGY_WORK_PAGE_IS_SHOWN = 'STRATEGY_WORK_PAGE_IS_SHOWN'
export const START_AS_GUEST = 'START_AS_GUEST'

// Eval actions.
// TODO(cyrille): Migrate here the eval actions from above.

export const CREATE_USE_CASE = 'CREATE_USE_CASE'

// Logging only.
const LANDING_PAGE_SECTION_IS_SHOWN = 'LANDING_PAGE_SECTION_IS_SHOWN'
const STATIC_ADVICE_PAGE_IS_SHOWN = 'STATIC_ADVICE_PAGE_IS_SHOWN'
const FOLLOW_JOB_OFFERS_LINK = 'FOLLOW_JOB_OFFERS_LINK'
const OPEN_STATS_PAGE = 'OPEN_STATS_PAGE'

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
  [FOLLOW_JOB_OFFERS_LINK]: 'Follow a link to job offers',
  [GET_USER_DATA]: 'Load app',
  [LANDING_PAGE_SECTION_IS_SHOWN]: 'A landing page section is shown',
  [LOAD_LANDING_PAGE]: 'Load landing page',
  [LOGOUT]: 'Log out',
  [MARK_CHANGELOG_AS_SEEN]: 'Mark Changelog as seen',
  [MIGRATE_USER_TO_ADVISOR]: 'Migrate to advisor',
  [MODIFY_PROJECT]: 'Modify project',
  [OPEN_LOGIN_MODAL]: 'Open login modal',
  [OPEN_REGISTER_MODAL]: 'Open register modal',
  [OPEN_STATS_PAGE]: 'Open a link to market statistical information',
  [OPEN_TIP_EXTERNAL_LINK]: 'Open tip external link',
  [PRODUCT_UPDATED_PAGE_IS_SHOWN]: 'Product has been updated page shown',
  [READ_TIP]: 'Open tip',
  [REGISTER_USER]: 'Register new user',
  [REPLACE_STRATEGY]: 'Update strategy advancement',
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
  [START_AS_GUEST]: 'Start as guest',
  [START_STRATEGY]: 'Start a job search strategy',
  [STATIC_ADVICE_PAGE_IS_SHOWN]: 'A static advice page is shown',
  [STRATEGY_EXPLORATION_PAGE_IS_SHOWN]: 'A strategy page is shown in exploration mode',
  [STRATEGY_WORK_PAGE_IS_SHOWN]: 'A strategy page is shown in work mode',
  [WORKBENCH_IS_SHOWN]: 'The workbench is shown',
}

interface PotentialRegisterAction {
  response?: {
    isNewUser?: boolean
  }
  type?: string
}

function isActionRegister({response, type}: PotentialRegisterAction): boolean {
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

export type AcceptCookiesUsageAction = Readonly<Action<typeof ACCEPT_COOKIES_USAGE>>
const acceptCookiesUsageAction: AcceptCookiesUsageAction = {type: ACCEPT_COOKIES_USAGE}

export type HideToasterMessageAction = Readonly<Action<typeof HIDE_TOASTER_MESSAGE>>
const hideToasterMessageAction: HideToasterMessageAction = {type: HIDE_TOASTER_MESSAGE}

export type LogoutAction = Readonly<Action<typeof LOGOUT>>
const logoutAction: LogoutAction = {type: LOGOUT}

export type OpenStatsPageAction = Readonly<Action<typeof OPEN_STATS_PAGE>>
const openStatsPageAction: OpenStatsPageAction = {type: OPEN_STATS_PAGE}

export type RemoveAuthDataAction = Readonly<Action<'REMOVE_AUTH_DATA'>>
const removeAuthData: RemoveAuthDataAction = {type: 'REMOVE_AUTH_DATA'}

export type FollowJobOffersLinkAction = Readonly<Action<typeof FOLLOW_JOB_OFFERS_LINK>>
const followJobOffersLinkAction: FollowJobOffersLinkAction = {type: FOLLOW_JOB_OFFERS_LINK}

export type ProductUpdatedPageIsShownAction = Readonly<Action<typeof PRODUCT_UPDATED_PAGE_IS_SHOWN>>
const productUpdatedPageIsShownAction: ProductUpdatedPageIsShownAction =
  {type: PRODUCT_UPDATED_PAGE_IS_SHOWN}

export type SwitchToMobileVersionAction = Readonly<Action<typeof SWITCH_TO_MOBILE_VERSION>>
const switchToMobileVersionAction: SwitchToMobileVersionAction = {type: SWITCH_TO_MOBILE_VERSION}

// Synchronous action generators, keep them grouped and alpha sorted.

export interface ProjectAction<T extends string> extends Readonly<Action<T>> {
  readonly project: bayes.bob.Project
}

export interface StrategyAction<T extends string> extends ProjectAction<T> {
  readonly strategyRank: number
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

export interface ActivateDemoInFutureAction extends Readonly<Action<typeof WILL_ACTIVATE_DEMO>> {
  readonly demo: string
}
function activateDemoInFuture(demo: string): ActivateDemoInFutureAction {
  return {demo, type: WILL_ACTIVATE_DEMO}
}

type AdviceCardIsShownAction = AdviceAction<typeof ADVICE_CARD_IS_SHOWN>

function adviceCardIsShown(project: bayes.bob.Project, advice: bayes.bob.Advice):
AdviceCardIsShownAction {
  return {advice, project, type: ADVICE_CARD_IS_SHOWN}
}

interface ChangeSubmetricExpansionAction extends
  Readonly<Action<typeof CHANGE_SUBMETRIC_EXPANSION>> {
  readonly isExpanded: boolean
  readonly topic: string
}

interface OpenLoginModalActionBase<T extends string> extends VisualElementAction<T> {
  readonly defaultValues: {}
}

function changeSubmetricExpansion(topic: string, isExpanded: boolean):
ChangeSubmetricExpansionAction {
  return {isExpanded, topic, type: CHANGE_SUBMETRIC_EXPANSION}
}

interface CloseLoginModalAction extends Readonly<Action<typeof CLOSE_LOGIN_MODAL>> {
  readonly hasCanceledLogin?: boolean
}

// TODO(pascal): Check if we need hasCanceledLogin somehow.
function closeLoginModal(unusedHasCanceledLogin?: boolean):
ThunkAction<CloseLoginModalAction, RootState, {}, AllActions> {
  return (dispatch): CloseLoginModalAction => {
    return dispatch({type: CLOSE_LOGIN_MODAL})
  }
}

type DiagnosticTalkIsShownAction = ProjectAction<typeof DIAGNOSTIC_TALK_IS_SHOWN>

function diagnosticTalkIsShown(project: bayes.bob.Project): DiagnosticTalkIsShownAction {
  return {project, type: DIAGNOSTIC_TALK_IS_SHOWN}
}

export interface DisplayToastMessageAction extends Readonly<Action<typeof DISPLAY_TOAST_MESSAGE>> {
  readonly error: string
}

function displayToasterMessage(error: string): DisplayToastMessageAction {
  return {error, type: DISPLAY_TOAST_MESSAGE}
}

type DownloadDiagnosticPdfAction = ProjectAction<typeof DOWNLOAD_DIAGNOSTIC_PDF>

function downloadDiagnosticAsPdf(project: bayes.bob.Project): DownloadDiagnosticPdfAction {
  return {project, type: DOWNLOAD_DIAGNOSTIC_PDF}
}

type LandingPageSectionIsShownAction = VisualElementAction<typeof LANDING_PAGE_SECTION_IS_SHOWN>

function landingPageSectionIsShown(sectionName: string): LandingPageSectionIsShownAction {
  return {type: LANDING_PAGE_SECTION_IS_SHOWN, visualElement: sectionName}
}

function modifyProject(project: bayes.bob.Project): ModifyProjectAction {
  return {project, type: MODIFY_PROJECT}
}

type OpenLoginModalAction = OpenLoginModalActionBase<typeof OPEN_LOGIN_MODAL>

function openLoginModal(defaultValues: {}, visualElement: string): OpenLoginModalAction {
  return {defaultValues, type: OPEN_LOGIN_MODAL, visualElement}
}

type OpenRegistrationModalAction = OpenLoginModalActionBase<typeof OPEN_REGISTER_MODAL>

function openRegistrationModal(defaultValues: {}, visualElement: string):
OpenRegistrationModalAction {
  return {defaultValues, type: OPEN_REGISTER_MODAL, visualElement}
}

type OpenTipExternalLinkAction = TipAction<typeof OPEN_TIP_EXTERNAL_LINK>

function openTipExternalLink(action: {actionId: string}): OpenTipExternalLinkAction {
  return {action, type: OPEN_TIP_EXTERNAL_LINK}
}

export interface LoadLandingPageAction extends Readonly<Action<typeof LOAD_LANDING_PAGE>> {
  readonly defaultProjectProps?: bayes.bob.Project
  readonly landingPageKind: string
  readonly timeToFirstInteractiveMillisecs: number
}

function loadLandingPage(
  timeToFirstInteractiveMillisecs: number, landingPageKind: string, specificJob: {}):
  LoadLandingPageAction {
  return {
    defaultProjectProps: specificJob ? {targetJob: specificJob} : {},
    landingPageKind,
    timeToFirstInteractiveMillisecs,
    type: LOAD_LANDING_PAGE,
  }
}

interface ReadTipAction extends TipAction<typeof READ_TIP> {
  readonly feedback?: string
}

function readTip(action: {actionId: string}, feedback?: string): ReadTipAction {
  return {action, feedback, type: READ_TIP}
}

type SeeAdviceAction = AdviceAction<typeof SEE_ADVICE>

function seeAdvice(project: bayes.bob.Project, advice: bayes.bob.Advice): SeeAdviceAction {
  return {advice, project, type: SEE_ADVICE}
}

type ShareProductModalIsShownAction = VisualElementAction<typeof SHARE_PRODUCT_MODAL_IS_SHOWN>

function shareProductModalIsShown(visualElement: string): ShareProductModalIsShownAction {
  return {type: SHARE_PRODUCT_MODAL_IS_SHOWN, visualElement}
}

type ShareProductToNetworkAction = VisualElementAction<typeof SHARE_PRODUCT_TO_NETWORK>

function shareProductToNetwork(visualElement: string): ShareProductToNetworkAction {
  return {type: SHARE_PRODUCT_TO_NETWORK, visualElement}
}

type ShowAllTipsAction = AdviceAction<typeof SHOW_ALL_TIPS>

function showAllTips(project: bayes.bob.Project, advice: bayes.bob.Advice): ShowAllTipsAction {
  return {advice, project, type: SHOW_ALL_TIPS}
}

type StartAsGuestAction = VisualElementAction<typeof START_AS_GUEST> & {
  readonly defaultProjectProps?: bayes.bob.Project
}

function startAsGuest(
  visualElement: string, city?: bayes.bob.FrenchCity, targetJob?: bayes.bob.Job):
  StartAsGuestAction {
  return {
    defaultProjectProps: (city || targetJob) ? {city, targetJob} : undefined,
    type: START_AS_GUEST,
    visualElement,
  }
}

type StartStrategyAction = StrategyAction<typeof START_STRATEGY>

function startStrategy(
  project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy, strategyRank: number,
): StartStrategyAction {
  return {project, strategy, strategyRank, type: START_STRATEGY}
}

type StaticAdvicePageIsShownAction = VisualElementAction<typeof STATIC_ADVICE_PAGE_IS_SHOWN>

// TODO(marielaure): Use a  dedicated field here instead of visualElement.
function staticAdvicePageIsShown(adviceId: string): StaticAdvicePageIsShownAction {
  return {type: STATIC_ADVICE_PAGE_IS_SHOWN, visualElement: adviceId}
}

type StrategyExplorationPageIsShown = StrategyAction<typeof STRATEGY_EXPLORATION_PAGE_IS_SHOWN>

function strategyExplorationPageIsShown(
  project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy, strategyRank: number,
): StrategyExplorationPageIsShown {
  return {project, strategy, strategyRank, type: STRATEGY_EXPLORATION_PAGE_IS_SHOWN}
}

type StrategyWorkPageIsShown = StrategyAction<typeof STRATEGY_WORK_PAGE_IS_SHOWN>

function strategyWorkPageIsShown(
  project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy, strategyRank: number,
): StrategyWorkPageIsShown {
  return {project, strategy, strategyRank, type: STRATEGY_WORK_PAGE_IS_SHOWN}
}

type WorkbenchIsShownAction = ProjectAction<typeof WORKBENCH_IS_SHOWN>

function workbenchIsShown(project: bayes.bob.Project): WorkbenchIsShownAction {
  return {project, type: WORKBENCH_IS_SHOWN}
}

interface TrackInitialUtmAction extends Readonly<Action<typeof TRACK_INITIAL_UTM>>{
  readonly utm: {
    readonly source?: string
  }
}

function trackInitialUtm(utm: {}): TrackInitialUtmAction {
  return {type: TRACK_INITIAL_UTM, utm}
}

interface TrackInitialFeaturesAction extends Readonly<Action<typeof TRACK_INITIAL_FEATURES>> {
  readonly features: {
    [featureId: string]: true
  }
}

// TODO(pascal): Consider removing.
function trackInitialFeatures(features: {}): TrackInitialFeaturesAction {
  return {features, type: TRACK_INITIAL_FEATURES}
}

// Asynchronous action generators.

interface AsyncError {
  readonly error: Error | string
  readonly status: 'error'
}


export type AsyncAction<T extends string, Result> = Readonly<Action<T>> & {
  ASYNC_MARKER: typeof ASYNC_MARKER
  ignoreFailure?: boolean
} & ({readonly status: 'sending'} | AsyncError | {
  readonly response: Result
  readonly status: 'success'
})


// Wrap an async function by dispatching an action before and after the
// function: the initial action has the given type and an ASYNC_MARKER, the
// final action has the same type and marker but also a status 'success' or
// 'error' with additional response or error var. The asyncFunc doesn't take
// any parameter and should return a promise.
// The promise returned by this function always resolve, to undefined if
// there's an error.
function wrapAsyncAction<T extends string, Extra, Result, A extends AsyncAction<T, Result> & Extra>(
  actionType: T, asyncFunc: () => Promise<Result>, options?: Extra):
  ThunkAction<Promise<Result|void>, {}, Extra, Action> {
  return (dispatch): Promise<Result|void> => {
    const action = {...options, ASYNC_MARKER, type: actionType}
    dispatch(action)
    const promise: Promise<Result> = asyncFunc()
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
  AsyncAction<typeof COMPUTE_ADVICES_FOR_PROJECT, bayes.bob.Advices>

function computeAdvicesForProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Advices|void>, {}, {}, ComputeAdvicesForProjectAction> {
  return wrapAsyncAction(
    COMPUTE_ADVICES_FOR_PROJECT, (): Promise<bayes.bob.Advices> => projectComputeAdvicesPost(user))
}

type ConvertUserWithAdvicesSelectionFromProtoAction =
  AsyncAction<typeof CONVERT_PROTO, bayes.bob.UserWithAdviceSelection>

function convertUserWithAdviceSelectionFromProto(proto: string):
ThunkAction<
Promise<bayes.bob.UserWithAdviceSelection | void>,
{}, {}, ConvertUserWithAdvicesSelectionFromProtoAction> {
  return wrapAsyncAction(CONVERT_PROTO, (): Promise<bayes.bob.UserWithAdviceSelection> =>
    convertUserWithAdviceSelectionFromProtoPost(proto))
}

type ConvertUserWithAdvicesSelectionToProtoAction = AsyncAction<typeof CONVERT_PROTO, string>

function convertUserWithAdviceSelectionToProto(proto: bayes.bob.UserWithAdviceSelection):
ThunkAction<Promise<string|void>, {}, {}, ConvertUserWithAdvicesSelectionToProtoAction> {
  return wrapAsyncAction(CONVERT_PROTO, (): Promise<string> =>
    convertUserWithAdviceSelectionToProtoPost(proto))
}

type DiagnoseProjectAction = AsyncAction<typeof DIAGNOSE_PROJECT, bayes.bob.Diagnostic>

function diagnoseProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Diagnostic|void>, {}, {}, DiagnoseProjectAction> {
  return wrapAsyncAction(
    DIAGNOSE_PROJECT, (): Promise<bayes.bob.Diagnostic> => projectDiagnosePost(user))
}

type StrategizeProjectAction = AsyncAction<typeof STRATEGIZE_PROJECT, bayes.bob.Strategies>

function strategizeProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Strategies|void>, {}, {}, StrategizeProjectAction> {
  return wrapAsyncAction(
    STRATEGIZE_PROJECT, (): Promise<bayes.bob.Strategies> => projectStrategizePost(user))
}

type GetAdviceTipsAction = AsyncAction<typeof GET_ADVICE_TIPS, readonly bayes.bob.Action[]> & {
  advice: bayes.bob.Advice
  project: bayes.bob.Project
}

function getAdviceTips(project: bayes.bob.Project, advice: bayes.bob.Advice):
ThunkAction<Promise<readonly bayes.bob.Action[]|void>, RootState, {}, GetAdviceTipsAction> {
  return (dispatch: DispatchAllActions, getState: () => RootState):
  Promise<readonly bayes.bob.Action[]|void> => {
    const {user, app} = getState()
    return dispatch(wrapAsyncAction(
      GET_ADVICE_TIPS,
      (): Promise<readonly bayes.bob.Action[]> =>
        adviceTipsGet(user, project, advice, app.authToken),
      {advice, project}))
  }
}

type GetExpandedCardContentAction = AsyncAction<typeof GET_EXPANDED_CARD_CONTENT, {}> & {
  advice: bayes.bob.Advice
  project: bayes.bob.Project
}

function getExpandedCardContent(project: bayes.bob.Project, adviceId: string):
ThunkAction<Promise<{}|void>, RootState, {}, GetExpandedCardContentAction> {
  return (dispatch: DispatchAllActions, getState: () => RootState): Promise<{}|void> => {
    const {user, app} = getState()
    return dispatch(
      wrapAsyncAction(
        GET_EXPANDED_CARD_CONTENT,
        (): Promise<{}> => expandedCardContentGet(user, project, {adviceId}, app.authToken),
        {advice: {adviceId}, project}))
  }
}

type GetJobAction = AsyncAction<typeof GET_JOBS, bayes.bob.JobGroup> & {
  romeId: string
}

function getJobs({romeId}: bayes.bob.JobGroup):
ThunkAction<Promise<bayes.bob.JobGroup|void>, {}, {}, GetJobAction> {
  return (dispatch: DispatchAllActions): Promise<bayes.bob.JobGroup|void> => {
    return dispatch(wrapAsyncAction(
      GET_JOBS, (): Promise<bayes.bob.JobGroup> => jobsGet(romeId), {romeId}))
  }
}

type GetApplicationModesAction = AsyncAction<typeof GET_APPLICATION_MODES, bayes.bob.JobGroup> & {
  romeId: string
}

function fetchApplicationModes({romeId}: bayes.bob.JobGroup):
ThunkAction<Promise<bayes.bob.JobGroup|void>, {}, {}, GetApplicationModesAction> {
  return (dispatch: DispatchAllActions): Promise<bayes.bob.JobGroup|void> => {
    return dispatch(wrapAsyncAction(
      GET_APPLICATION_MODES,
      (): Promise<bayes.bob.JobGroup> => applicationModesGet(romeId),
      {romeId}))
  }
}

type GetProjectRequirementsAction =
  AsyncAction<typeof GET_PROJECT_REQUIREMENTS, bayes.bob.JobRequirements> &
  {project: bayes.bob.Project}

function fetchProjectRequirements(project: bayes.bob.Project):
ThunkAction<Promise<bayes.bob.JobRequirements|void>, {}, {}, GetProjectRequirementsAction> {
  return wrapAsyncAction(
    GET_PROJECT_REQUIREMENTS,
    (): Promise<bayes.bob.JobRequirements> => jobRequirementsGet(project.targetJob.jobGroup.romeId),
    {project},
  )
}

type DeleteUserAction = AsyncAction<typeof DELETE_USER_DATA, bayes.bob.User>

function deleteUser(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, DeleteUserAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {app} = getState()
    return dispatch(wrapAsyncAction(
      DELETE_USER_DATA, (): Promise<bayes.bob.User> => userDelete(user, app.authToken)))
  }
}

export type GetUserDataAction = AsyncAction<typeof GET_USER_DATA, bayes.bob.User>

function fetchUser(userId: string, ignoreFailure: boolean):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, GetUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {authToken} = getState().app
    return dispatch(
      wrapAsyncAction(
        GET_USER_DATA,
        (): Promise<bayes.bob.User> => markUsedAndRetrievePost(userId, authToken),
        {ignoreFailure}))
  }
}

type PostUserDataAction = AsyncAction<typeof POST_USER_DATA, bayes.bob.User>

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
      POST_USER_DATA, (): Promise<bayes.bob.User> => userPost(trackedUser, authToken)))
  }
}

type DiagnoseOnboardingAction =
  AsyncAction<typeof DIAGNOSE_ONBOARDING, bayes.bob.QuickDiagnostic> & {
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
    return dispatch(wrapAsyncAction(DIAGNOSE_ONBOARDING, (): Promise<bayes.bob.QuickDiagnostic> =>
      onboardingDiagnosePost({user: completeUserDiff}, authToken), {user: completeUserDiff}))
  }
}

type ActivateDemoAction = Readonly<Action<typeof ACTIVATE_DEMO>> & {demo: string}

function activateDemo(demo: string):
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, ActivateDemoAction | PostUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    dispatch({demo, type: ACTIVATE_DEMO})
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
          return projectPost(user, project, projectDiff, authToken)
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
          return advicePost(user, project, advice, adviceDiff, authToken)
        }
        return Promise.resolve({...advice, ...adviceDiff})
      },
      {advice, adviceDiff, project, ...options},
    ))
  }
}

type AsyncUpdateAdviceAction<T extends string> = AsyncAction<T, bayes.bob.Advice> & AdviceExtra
type AdvicePageIsShownAction = AsyncUpdateAdviceAction<typeof ADVICE_PAGE_IS_SHOWN>

function advicePageIsShown(project: bayes.bob.Project, advice: bayes.bob.Advice):
ThunkAction<Promise<bayes.bob.Advice|void>, RootState, {}, AdvicePageIsShownAction> {
  return updateAdvice(ADVICE_PAGE_IS_SHOWN, project, advice, {status: 'ADVICE_READ'})
}

type DiagnosticIsShownAction =
  AsyncAction<typeof DIAGNOSTIC_IS_SHOWN, bayes.bob.Project> & ProjectExtra

function diagnosticIsShown(project: bayes.bob.Project):
ThunkAction<Promise<bayes.bob.Project|void>, RootState, {}, DiagnosticIsShownAction> |
Action<typeof DIAGNOSTIC_IS_SHOWN> {
  if (project && project.diagnosticShownAt) {
    return {type: DIAGNOSTIC_IS_SHOWN}
  }
  const now = new Date()
  now.setMilliseconds(0)
  return updateProject(DIAGNOSTIC_IS_SHOWN, project, {diagnosticShownAt: now.toISOString()})
}

type ExploreAdviceAction =
  AsyncUpdateAdviceAction<typeof EXPLORE_ADVICE> & VisualElementAction<typeof EXPLORE_ADVICE>

function exploreAdvice(project: bayes.bob.Project, advice: bayes.bob.Advice, visualElement: string):
ThunkAction<
Promise<bayes.bob.Advice|void>, RootState, {visualElement: string}, ExploreAdviceAction> {
  return updateAdvice(
    EXPLORE_ADVICE, project, advice,
    {numExplorations: (advice.numExplorations || 0) + 1},
    {visualElement})
}

export interface WithFeedback {
  feedback: bayes.bob.Feedback
}

function sendFeedback<T extends string, Extra, A extends AsyncAction<T, string> & WithFeedback>(
  type: T, source: string, feedback: bayes.bob.Feedback, extraFields?: Extra):
  ThunkAction<Promise<{}|void>, RootState, {}, A> {
  return (dispatch: DispatchAllActions, getState): Promise<{}|void> => {
    const {user, app} = getState()
    return dispatch(wrapAsyncAction<T, WithFeedback, {}, A>(
      type,
      (): Promise<{}> => feedbackPost({
        feedback,
        source,
        userId: user.userId,
        ...extraFields,
      }, app.authToken),
      {feedback},
    )).then((response: string): string => {
      if (response) {
        dispatch(displayToasterMessage('Merci pour ce retour'))
      }
      return response
    })
  }
}

type SendAdviceFeedbackAction = AsyncAction<typeof SEND_ADVICE_FEEDBACK, {}> & WithFeedback

function sendAdviceFeedback(
  {projectId = ''}: bayes.bob.Project = {}, {adviceId}: bayes.bob.Advice,
  feedback: bayes.bob.Feedback, score: number = 0):
  ThunkAction<Promise<{}|void>, RootState, {}, SendAdviceFeedbackAction> {
  return sendFeedback(
    SEND_ADVICE_FEEDBACK, 'ADVICE_FEEDBACK', feedback, {adviceId, projectId, score})
}

type SendProfessionalFeedbackAction =
  AsyncAction<typeof SEND_PROFESSIONAL_FEEDBACK, {}> & WithFeedback

function sendProfessionalFeedback(feedback: bayes.bob.Feedback):
ThunkAction<Promise<{}|void>, RootState, {}, SendProfessionalFeedbackAction> {
  return sendFeedback(SEND_PROFESSIONAL_FEEDBACK, 'PROFESSIONAL_PAGE_FEEDBACK', feedback)
}

type SendProjectFeedbackAction =
  AsyncAction<typeof SEND_PROJECT_FEEDBACK, bayes.bob.Project> & WithFeedback & {
    readonly project: bayes.bob.Project
    readonly projectDiff: bayes.bob.Project
  }

function sendProjectFeedback(project: bayes.bob.Project, feedback: bayes.bob.ProjectFeedback):
ThunkAction<Promise<bayes.bob.Project|void>, RootState, {}, SendProjectFeedbackAction> {
  return (dispatch: DispatchAllActions): Promise<bayes.bob.Project|void> => {
    return dispatch(updateProject(SEND_PROJECT_FEEDBACK, project, {feedback})).
      then((response: bayes.bob.Project): bayes.bob.Project => {
        if (response) {
          dispatch(displayToasterMessage('Merci pour ce retour !'))
        }
        return response
      })
  }
}

type SendChangelogFeedbackAction =
  AsyncAction<typeof SEND_CHANGELOG_FEEDBACK, {}> & WithFeedback

function sendChangelogFeedback(feedback: bayes.bob.Feedback):
ThunkAction<Promise<{}|void>, RootState, {}, SendChangelogFeedbackAction> {
  return sendFeedback(SEND_CHANGELOG_FEEDBACK, 'CHANGELOG_FEEDBACK', feedback)
}

type ReplaceStrategyAction = AsyncAction<typeof REPLACE_STRATEGY, bayes.bob.WorkingStrategy> & {
  readonly project: bayes.bob.Project
  readonly strategy: bayes.bob.WorkingStrategy
}

function replaceStrategy(project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy):
ThunkAction<Promise<bayes.bob.WorkingStrategy|void>, RootState, {}, ReplaceStrategyAction> {
  return (dispatch, getState): Promise<bayes.bob.WorkingStrategy|void> => {
    const {app: {authToken}, user} = getState()
    return dispatch(wrapAsyncAction(
      REPLACE_STRATEGY,
      (): Promise<bayes.bob.WorkingStrategy> => {
        if (user.userId) {
          return strategyPost(user, project, strategy, authToken)
        }
        return Promise.resolve(strategy)
      },
      {project, strategy},
    ))
  }
}

const _FACEBOOK_GENDER_MAPPING: {female: 'FEMININE'; male: 'MASCULINE'} = {
  female: 'FEMININE',
  male: 'MASCULINE',
}

export type AuthenticateUserAction =
  AsyncAction<typeof AUTHENTICATE_USER, bayes.bob.AuthResponse> & {
    method: string
  }

function asyncAuthenticate(
  authenticate: (request: bayes.bob.AuthRequest) => Promise<bayes.bob.AuthResponse>,
  authRequest: bayes.bob.AuthRequest,
  method: string, callback?: (response: bayes.bob.AuthResponse) => bayes.bob.AuthResponse):
  ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AllActions> {
  return (dispatch, getState): Promise<bayes.bob.AuthResponse|void> => {
    const {app: {authToken, initialFeatures}, user: {hasAccount, userId}} = getState()
    const finalAuthRequest = {
      ...authRequest,
      ...initialFeatures ? {userData: initialFeatures} : {},
      ...userId && !hasAccount && !authRequest.authToken ? {authToken, userId} : {},
    }
    return dispatch(wrapAsyncAction(
      AUTHENTICATE_USER,
      (): Promise<bayes.bob.AuthResponse> => authenticate(finalAuthRequest).then(callback),
      {method}
    )).then((authResponse): bayes.bob.AuthResponse|void => {
      if (!authResponse) {
        // There was an error while connecting, return to a clean authentication state.
        // TODO(cyrille): Handle the case where there's a response with an invalid body.
        dispatch(removeAuthData)
      }
      return authResponse
    })
  }
}

interface FacebookAuthRequest {
  birthday?: string
  email: string
  gender?: 'female' | 'male'
  id: string
  name?: string
  picture?: {
    data?: {url?: string}
  }
  signedRequest: string
}

interface MockApi {
  userAuthenticate: typeof userAuthenticate
}

function facebookAuthenticateUser(facebookAuth: FacebookAuthRequest, mockApi?: MockApi):
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
    email: facebookAuth.email,
    facebookSignedRequest: facebookAuth.signedRequest,
  }, 'facebook', (authResponse: bayes.bob.AuthResponse): bayes.bob.AuthResponse => {
    // The signed request sent to the server only contains the facebook ID. If
    // it is verified we trust the full facebookAuth object and add non-signed
    // fields that we need.
    if (!authResponse || !authResponse.authenticatedUser ||
        facebookAuth.id !== authResponse.authenticatedUser.facebookId) {
      return authResponse
    }
    const userProfile = {...authResponse.authenticatedUser.profile} || {}
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


function googleAuthenticateUser(googleAuth, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {
    googleTokenId: googleAuth.getAuthResponse().id_token,
  }, 'google', (authResponse: bayes.bob.AuthResponse): bayes.bob.AuthResponse => {
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

function peConnectAuthenticateUser(code, nonce, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {
    peConnectCode: code,
    peConnectNonce: nonce,
  }, 'peConnect')
}

function linkedInAuthenticateUser(code, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {linkedInCode: code}, 'linkedIn')
}

type EmailCheckAction = AsyncAction<typeof EMAIL_CHECK, bayes.bob.AuthResponse> & {method: string}

function emailCheck(email: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, {}, {}, EmailCheckAction> {
  return wrapAsyncAction(
    EMAIL_CHECK,
    (): Promise<bayes.bob.AuthResponse> => userAuthenticate({email}),
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

function registerNewGuestUser(firstName: string, userData?: bayes.bob.AuthUserData):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, {}, AuthenticateUserAction> {
  return asyncAuthenticate(userAuthenticate, {
    firstName: upperFirstLetter(firstName.trim()),
    userData,
  }, 'guest')
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
    AUTHENTICATE_USER, (): Promise<bayes.bob.AuthResponse> => userAuthenticate({authToken, userId}))
}

interface MarkChangelogAsSeenAction extends Readonly<Action<typeof MARK_CHANGELOG_AS_SEEN>> {
  readonly changelog: string
}

function markChangelogAsSeen(changelog: string):
ThunkAction<
Promise<bayes.bob.User|void>, RootState, {}, MarkChangelogAsSeenAction | PostUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    dispatch({changelog, type: MARK_CHANGELOG_AS_SEEN})
    return dispatch(saveUser(getState().user))
  }
}

type MigrateUserToAdviceAction = AsyncAction<typeof MIGRATE_USER_TO_ADVISOR, bayes.bob.User>

function migrateUserToAdvisor():
ThunkAction<Promise<bayes.bob.User|void>, RootState, {}, MigrateUserToAdviceAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {authToken} = getState().app
    return dispatch(wrapAsyncAction(
      MIGRATE_USER_TO_ADVISOR,
      (): Promise<bayes.bob.User> => migrateUserToAdvisorPost(getState().user, authToken)))
  }
}

export type PageIsLoadedAction = Readonly<Action<typeof PAGE_IS_LOADED>> & {
  readonly location: {
    readonly pathname: string
  }
}

function pageIsLoaded(location: {readonly pathname: string}): PageIsLoadedAction {
  return {location: location || window.location, type: PAGE_IS_LOADED}
}

function resetPassword(email: string, password: string, authToken: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, {}, {}, AuthenticateUserAction> {
  const cleanEmail = email.trim()
  return wrapAsyncAction(
    AUTHENTICATE_USER, (): Promise<bayes.bob.AuthResponse> => userAuthenticate({
      authToken, email: cleanEmail, hashedPassword: sha1(cleanEmail + password)}))
}


interface ProfileAction<T extends string> extends Readonly<Action<T>> {
  userProfile: bayes.bob.UserProfile
}

type AcceptPrivacyNoticeAction = ProfileAction<typeof ACCEPT_PRIVACY_NOTICE>
type FinishProfileFrustrationsAction = ProfileAction<typeof FINISH_PROFILE_FRUSTRATIONS>
type FinishProfileSettingsAction = ProfileAction<typeof FINISH_PROFILE_SETTINGS>
type FinishProfileSituationAction = ProfileAction<typeof FINISH_PROFILE_SITUATION>
type SetUserProfileAction = ProfileAction<typeof SET_USER_PROFILE>

function setUserProfile<T extends string = typeof SET_USER_PROFILE>(
  userProfile: bayes.bob.UserProfile, shouldAlsoSaveUser: boolean,
  type: T | typeof SET_USER_PROFILE = SET_USER_PROFILE):
  ThunkAction<
  Promise<bayes.bob.User|void>, RootState, {}, ProfileAction<T | typeof SET_USER_PROFILE>> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    // Drop unknown kinds.
    // TODO(pascal): Check that gender, situation, jobSearchPhase
    // are consistent with their kinds, if they exist.
    dispatch({type, userProfile})
    const {user} = getState()
    if (shouldAlsoSaveUser) {
      return dispatch(saveUser(user))
    }
    return Promise.resolve(user)
  }
}

type CreateProjectAction = ProjectAction<typeof CREATE_PROJECT>
type FinishProjectCriteriaAction = ProjectAction<typeof FINISH_PROJECT_CRITERIA>
type FinishProjectGoalAction = ProjectAction<typeof FINISH_PROJECT_GOAL>
type FinishProjectExperienceAction = ProjectAction<typeof FINISH_PROJECT_EXPERIENCE>
type EditFirstProjectAction = ProjectAction<typeof EDIT_FIRST_PROJECT>
type ModifyProjectAction = ProjectAction<typeof MODIFY_PROJECT>

function editFirstProject<T extends string>(
  newProjectData: bayes.bob.Project, actionType: T | typeof EDIT_FIRST_PROJECT):
  ThunkAction<
  Promise<bayes.bob.User|void>, RootState, {}, ProjectAction<T | typeof EDIT_FIRST_PROJECT>> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {user} = getState()
    const project = newProject(newProjectData, user.profile && user.profile.gender || undefined)
    dispatch({project, type: actionType || EDIT_FIRST_PROJECT})
    return dispatch(saveUser(getState().user))
  }
}

type CreateProjectSaveAction = AsyncAction<typeof CREATE_PROJECT_SAVE, bayes.bob.User>

export interface RootState {
  app: AppState
  asyncState: AsyncState
  user: bayes.bob.User
}

function createFirstProject():
ThunkAction<
Promise<bayes.bob.User|void>, RootState, {}, CreateProjectAction | CreateProjectSaveAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {app: {authToken}, user: {projects: [project = {}] = []}} = getState()
    dispatch({project, type: CREATE_PROJECT})
    // Don't use normal saveUser to be able to distinguish between project creation and user saving.
    return dispatch(wrapAsyncAction(
      CREATE_PROJECT_SAVE, (): Promise<bayes.bob.User> => userPost(getState().user, authToken)))
  }
}

type ResetUserPasswordAction = AsyncAction<typeof RESET_USER_PASSWORD, {}>

function askPasswordReset(email: string):
ThunkAction<Promise<{}|void>, {}, {}, ResetUserPasswordAction> {
  return wrapAsyncAction(RESET_USER_PASSWORD, (): Promise<{}> => resetPasswordPost(email))
}

export interface AuthEvalState {
  fetchGoogleIdToken?: () => Promise<string>
}


export interface EvalRootState {
  asyncState: AsyncState
  auth: AuthEvalState
}

type EvalFiltersUseCasesAction =
  AsyncAction<typeof GET_EVAL_FILTERS_USE_CASES, readonly bayes.bob.UseCase[]>

function getEvalFiltersUseCases(filters: readonly string[]):
ThunkAction<Promise<readonly bayes.bob.UseCase[]|void>, EvalRootState, {},
EvalFiltersUseCasesAction> {
  return (dispatch, getState): Promise<readonly bayes.bob.UseCase[]|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      GET_EVAL_FILTERS_USE_CASES, (): Promise<readonly bayes.bob.UseCase[]> => fetchGoogleIdToken().
        then((googleIdToken: string): Promise<readonly bayes.bob.UseCase[]> =>
          evalFiltersUseCasesPost(filters, googleIdToken))))
  }
}

type GetEvalUseCasePoolsAction =
  AsyncAction<typeof GET_EVAL_USE_CASE_POOLS, readonly bayes.bob.UseCasePool[]>

function getEvalUseCasePools():
ThunkAction<Promise<readonly bayes.bob.UseCasePool[]|void>, EvalRootState, {},
GetEvalUseCasePoolsAction> {
  return (dispatch, getState): Promise<readonly bayes.bob.UseCasePool[]|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      GET_EVAL_USE_CASE_POOLS, (): Promise<readonly bayes.bob.UseCasePool[]> =>
        fetchGoogleIdToken().
          then((googleIdToken: string): Promise<readonly bayes.bob.UseCasePool[] > =>
            evalUseCasePoolsGet(googleIdToken))))
  }
}

type GetEvalUseCasesAction = AsyncAction<typeof GET_EVAL_USE_CASES, readonly bayes.bob.UseCase[]>

function getEvalUseCases(poolName: string):
ThunkAction<Promise<readonly bayes.bob.UseCase[]|void>, EvalRootState, {}, GetEvalUseCasesAction> {
  return (dispatch, getState): Promise<readonly bayes.bob.UseCase[]|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      GET_EVAL_USE_CASES, (): Promise<readonly bayes.bob.UseCase[]> => fetchGoogleIdToken().
        then((googleIdToken: string): Promise<readonly bayes.bob.UseCase[]> =>
          evalUseCasesGet(poolName, googleIdToken))))
  }
}

type GetUseCaseDistributionAction =
  AsyncAction<typeof GET_USE_CASE_DISTRIBUTION, bayes.bob.UseCaseDistribution>

function getUseCaseDistribution(
  categories: bayes.bob.DiagnosticCategory[] = [], maxUseCases: number):
  ThunkAction<
  Promise<bayes.bob.UseCaseDistribution|void>, EvalRootState, {}, GetUseCaseDistributionAction> {
  return (dispatch, getState): Promise<bayes.bob.UseCaseDistribution|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      GET_USE_CASE_DISTRIBUTION, (): Promise<bayes.bob.UseCaseDistribution> => fetchGoogleIdToken().
        then((googleIdToken: string): Promise<bayes.bob.UseCaseDistribution> =>
          useCaseDistributionPost({categories, maxUseCases}, googleIdToken))))
  }
}

type GetAllCategoriesAction = AsyncAction<typeof GET_ALL_CATEGORIES, bayes.bob.DiagnosticCategories>

function getAllCategories(useCase: bayes.bob.UseCase):
ThunkAction<
Promise<bayes.bob.DiagnosticCategories|void>, EvalRootState, {}, GetAllCategoriesAction> {
  return (dispatch, getState): Promise<bayes.bob.UseCaseDistribution|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      GET_ALL_CATEGORIES,
      (): Promise<bayes.bob.DiagnosticCategories> => fetchGoogleIdToken().
        then((googleIdToken: string): Promise<bayes.bob.DiagnosticCategories> =>
          getAllCategoriesPost(useCase, googleIdToken))))
  }
}

type CreateUseCaseAction = AsyncAction<typeof CREATE_USE_CASE, bayes.bob.UseCase>

function createUseCase(request: bayes.bob.UseCaseCreateRequest):
ThunkAction<
Promise<bayes.bob.UseCase|void>, EvalRootState, {}, CreateUseCaseAction> {
  return (dispatch, getState): Promise<bayes.bob.UseCase|void> => {
    const {fetchGoogleIdToken} = getState().auth
    return dispatch(wrapAsyncAction(
      CREATE_USE_CASE,
      (): Promise<bayes.bob.UseCase> => fetchGoogleIdToken().
        then((googleIdToken: string): Promise<bayes.bob.UseCase> =>
          createEvalUseCasePost(request, googleIdToken))))
  }
}

type GetLocalStatsAction = AsyncAction<typeof GET_LOCAL_STATS, bayes.bob.LaborStatsData>

function getLaborStats(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, {}, {}, GetLocalStatsAction> {
  return wrapAsyncAction(
    GET_LOCAL_STATS, (): Promise<bayes.bob.LaborStatsData> => projectLaborStatsPost(user))
}

// Type of the main dispatch function.
export type DispatchAllActions =
  // Add actions as required.
  ThunkDispatch<RootState, {}, ActivateDemoAction> &
  ThunkDispatch<RootState, {}, DiagnosticIsShownAction> &
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
  | AuthenticateUserAction
  | ChangeSubmetricExpansionAction
  | CloseLoginModalAction
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
  | GetAdviceTipsAction
  | GetExpandedCardContentAction
  | GetJobAction
  | GetApplicationModesAction
  | GetProjectRequirementsAction
  | GetUserDataAction
  | HideToasterMessageAction
  | FollowJobOffersLinkAction
  | LandingPageSectionIsShownAction
  | LoadLandingPageAction
  | LogoutAction
  | MarkChangelogAsSeenAction
  | MigrateUserToAdviceAction
  | ModifyProjectAction
  | OpenLoginModalAction
  | OpenRegistrationModalAction
  | OpenStatsPageAction
  | OpenTipExternalLinkAction
  | PageIsLoadedAction
  | PostUserDataAction
  | ProductUpdatedPageIsShownAction
  | ReadTipAction
  | RemoveAuthDataAction
  | ReplaceStrategyAction
  | SeeAdviceAction
  | SendProjectFeedbackAction
  | SetUserProfileAction
  | ShareProductModalIsShownAction
  | ShareProductToNetworkAction
  | ShowAllTipsAction
  | StartAsGuestAction
  | StartStrategyAction
  | StaticAdvicePageIsShownAction
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
  ThunkDispatch<EvalRootState, {}, StrategizeProjectAction> &
  Dispatch<AllEvalActions>


type SelectEvalUserAction = Action<'SELECT_USER'> & {
  user: bayes.bob.User
}


type EvalAuthAction = Action<'AUTH'> & {
  googleUser: {
    reloadAuthResponse: () => Promise<{'id_token': string}>
  }
}


export type AllEvalActions =
  | ComputeAdvicesForProjectAction
  | DiagnoseProjectAction
  | EvalAuthAction
  | CreateUseCaseAction
  | GetEvalUseCasesAction
  | GetEvalUseCasePoolsAction
  | GetLocalStatsAction
  | SelectEvalUserAction
  | StrategizeProjectAction


export type BootstrapAction =
  ComputeAdvicesForProjectAction |
  ConvertUserWithAdvicesSelectionToProtoAction |
  ConvertUserWithAdvicesSelectionFromProtoAction |
  DisplayToastMessageAction |
  SendAdviceFeedbackAction


export type DispatchBootstrapActions =
  ThunkDispatch<{}, {}, ComputeAdvicesForProjectAction> &
  (<T extends string, A extends Action<T>>(action: A) => A)


export {saveUser, hideToasterMessageAction, setUserProfile, fetchUser,
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
  peConnectAuthenticateUser, sendProjectFeedback, createUseCase,
  sendChangelogFeedback, landingPageSectionIsShown, openRegistrationModal,
  computeAdvicesForProject, diagnosticTalkIsShown, getAllCategories,
  getEvalUseCasePools, getEvalUseCases, getExpandedCardContent,
  activateDemoInFuture, activateDemo, diagnosticIsShown, downloadDiagnosticAsPdf,
  productUpdatedPageIsShownAction, loginUserFromToken, shareProductModalIsShown,
  staticAdvicePageIsShown, linkedInAuthenticateUser, pageIsLoaded,
  isActionRegister, workbenchIsShown, getEvalFiltersUseCases,
  exploreAdvice, diagnoseOnboarding, convertUserWithAdviceSelectionFromProto,
  convertUserWithAdviceSelectionToProto, replaceStrategy, fetchApplicationModes,
  changeSubmetricExpansion, getUseCaseDistribution, startStrategy,
  strategyExplorationPageIsShown, strategyWorkPageIsShown, getLaborStats,
  startAsGuest,
}

import type {TFunction} from 'i18next'
import type {ReactFacebookLoginInfo} from 'react-facebook-login'
import type {GoogleLoginResponse} from 'react-google-login'
import {useDispatch as reduxUseDispatch} from 'react-redux'
import type {Action, Dispatch} from 'redux'
import type {ThunkAction, ThunkDispatch} from 'redux-thunk'
import sha1 from 'sha1'

import {upperFirstLetter} from 'store/french'
import {newProject} from 'store/project'

import {adviceTipsGet, advicePost, projectPost, jobRequirementsGet, jobsGet, userDelete,
  markUsedAndRetrievePost, userPost, feedbackPost, userAuthenticate, resetPasswordPost,
  onboardingDiagnosePost, migrateUserToAdvisorPost, projectComputeAdvicesPost, userCountsGet,
  expandedCardContentGet, strategyPost, convertFromProtoPost, convertToProtoPost,
  projectLaborStatsPost, sendUserEmailPost, applicationModesGet, supportTicketPost,
  strategyDelete, authTokensGet, diagnosticMainChallengesPost, simulateFocusEmailsPost,
  listUserEmailsGet, actionPost, actionPlanEmailPost, projectComputeActionsPost, logoutPost,
  feedbackVolunteeringSend,
} from './api'

const ASYNC_MARKER = 'ASYNC_MARKER'

// Set of actions we want to log in the analytics
export const actionTypesToLog = {
  ACCEPT_PRIVACY_NOTICE: 'Accept privacy notice',
  ACTION_IS_SHOWN: 'Action from plan is shown',
  ADVICE_CARD_IS_SHOWN: 'Advice card is shown',
  ADVICE_PAGE_IS_SHOWN: 'Advice page shown',
  AUTHENTICATE_USER: 'Log in',
  CLICK_EXPLORE_ACTIONS_ACTION: 'Explore actions',
  COMPLETE_ACTION: 'Complete an action from action plan',
  CREATE_PROJECT: 'Create project',
  CREATE_PROJECT_SAVE: 'Save project',
  DELETE_USER_DATA: 'Delete user',
  DISPLAY_TOAST_MESSAGE: 'Display toast message',
  DROP_OUT_PROJECT_FEEDBACK: 'Drop out of project feedback',
  EXPAND_ACTION_LIST: 'Expand action list in action plan',
  EXPLORE_ACTION: 'Explore action (link)',
  EXPLORE_ADVICE: 'Explore advice (link or info)',
  FINISH_ACTION_PLAN_ONBOARDING: 'Finish action plan onboarding',
  FINISH_PROFILE_FRUSTRATIONS: 'Finish profile frustrations',
  FINISH_PROFILE_SETTINGS: 'Finish profile settings',
  FINISH_PROFILE_SITUATION: 'Finish profile situation',
  FINISH_PROJECT_EXPERIENCE: 'Finish project experience',
  FINISH_PROJECT_GOAL: 'Finish project goal',
  FINISH_PROJECT_SELF_DIAGNOSTIC: 'Finish project self-diagnostic',
  GET_USER_DATA: 'Load app',
  GO_TO_FIRST_STRATEGY: 'Go to first strategy',
  LANDING_PAGE_SECTION_IS_SHOWN: 'A landing page section is shown',
  LOAD_LANDING_PAGE: 'Load landing page',
  LOGOUT: 'Log out',
  MIGRATE_USER_TO_ADVISOR: 'Migrate to advisor',
  MODIFY_PROJECT: 'Modify project',
  ONBOARDING_PAGE: 'Fill the onboarding form',
  OPEN_ACTION_DATE: 'Open deadline action modal',
  OPEN_DETAIL_ACTION_ACTION: 'Click on the action title in the action plan',
  OPEN_LOGIN_MODAL: 'Open login modal',
  OPEN_REGISTER_MODAL: 'Open register modal',
  OPEN_STATS_PAGE: 'Open a link to market statistical information',
  OPEN_TIP_EXTERNAL_LINK: 'Open tip external link',
  PAGE_IS_LOADED: 'Page is loaded',
  PREVIEW_ACTION: 'Preview an action',
  READ_TIP: 'Open tip',
  REGISTER_USER: 'Register new user',
  RENAME_ACTION_PLAN: 'Give a name to the action plan',
  REPLACE_STRATEGY: 'Update strategy advancement',
  RESET_USER_PASSWORD: 'Ask password email',
  REVIEW_PROJECT_ACHIEVEMENTS: 'Acknowledge project achievements',
  REVIEW_PROJECT_MAIN_CHALLENGE: "Accept project's main challenge",
  REVIEW_PROJECT_PREVIEW_STRATS: 'Acknowledge project strats preview',
  SAVE_ACTION_DATE: 'Save date for an action for the action plan',
  SCORE_PROJECT_CHALLENGE_AGREEMENT: 'Score the project challenge agreement',
  SEE_ADVICE: 'See advice in dashboard',
  SELECT_ACTION: 'Select an action for the action plan',
  SEND_ACTION_PLAN_EMAIL: 'Ask for an email with action plan',
  SEND_ADVICE_FEEDBACK: 'Send advice feedback',
  SEND_PROFESSIONAL_FEEDBACK: 'Send feedback from professional page',
  SEND_PROJECT_FEEDBACK: 'Send project feedback',
  SET_USER_PROFILE: 'Update profile',
  SHARE_PRODUCT_MODAL_IS_SHOWN: 'Share product modal is shown',
  SHARE_PRODUCT_TO_NETWORK: 'Share product to network',
  SHOW_ALL_TIPS: 'Show all tips',
  START_AS_GUEST: 'Start as guest',
  START_PROJECT_FEEDBACK: 'Start scoring the project',
  START_STRATEGY: 'Start a job search strategy',
  STATIC_ADVICE_PAGE_IS_SHOWN: 'A static advice page is shown',
  STATS_PAGE_IS_SHOWN: 'The statistics page is shown',
  STRATEGY_WORK_PAGE_IS_SHOWN: 'A strategy page is shown in work mode',
  UNCOMPLETE_ACTION: 'Mark an action as not completed in action plan',
  UNSELECT_ACTION: 'Remove an action from the action plan',
  VALIDATE_ACTION_PLAN: 'Finish selecting actions for the action plan',
  VALIDATE_ACTION_PLAN_STRATEGY: 'Finish selecting actions for a strategy',
  WORKBENCH_IS_SHOWN: 'The workbench is shown',
}

const ACTIONS_FOR_ACTION_PLAN = new Set(['EXPAND_ACTION_LIST', 'VALIDATE_ACTION_PLAN',
  'SEND_ACTION_PLAN_EMAIL', 'OPEN_ACTION_DATE', 'CLICK_EXPLORE_ACTIONS_ACTION',
  'OPEN_DETAIL_ACTION_ACTION'])
function isActionForActionPlan<T extends string>(action: Readonly<Action<T>>):
action is ProjectAction<T> {
  return ACTIONS_FOR_ACTION_PLAN.has(action.type) && !!(action as ProjectAction<T>).project
}

function isActionRegister(action: AllActions): boolean {
  if (action.type !== 'AUTHENTICATE_USER' || action.status !== 'success') {
    return false
  }
  return !!action.response?.isNewUser
}


// Get the list of paths of defined fields.
// Only exported for testing.
export function getDefinedFieldsPath<T>(proto: T, prefix = ''): readonly string[] {
  if (typeof proto !== 'object' || !proto || Array.isArray(proto)) {
    return []
  }
  return Object.entries(proto).flatMap(([key, value]): readonly string[] => {
    if (typeof value === 'undefined') {
      return []
    }
    const subPaths = getDefinedFieldsPath(value, prefix + key + '.')
    if (subPaths.length) {
      return subPaths
    }
    return [prefix + key]
  })
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
// `await dispatch(doSomething(aboutThat))`

// Plain actions, keep them grouped and alpha sorted.

export type AcceptCookiesUsageAction = Readonly<Action<'ACCEPT_COOKIES_USAGE'>>
const acceptCookiesUsageAction: AcceptCookiesUsageAction = {type: 'ACCEPT_COOKIES_USAGE'}

export type AskForAdsCookiesUsageAction = Readonly<Action<'ASK_FOR_ADS_COOKIES_USAGE'>>
const askForAdsCookieUsageAction: AskForAdsCookiesUsageAction = {type: 'ASK_FOR_ADS_COOKIES_USAGE'}

export type DropOutProjectFeedbackAction = Readonly<Action<'DROP_OUT_PROJECT_FEEDBACK'>>
const dropOutProjectFeedbackAction: DropOutProjectFeedbackAction =
  {type: 'DROP_OUT_PROJECT_FEEDBACK'}

export type ClearExpiredTokenAction = Readonly<Action<'CLEAR_EXPIRED_TOKEN'>>
const clearExpiredTokenAction: ClearExpiredTokenAction = {type: 'CLEAR_EXPIRED_TOKEN'}

export type HideToasterMessageAction = Readonly<Action<'HIDE_TOASTER_MESSAGE'>>
const hideToasterMessageAction: HideToasterMessageAction = {type: 'HIDE_TOASTER_MESSAGE'}

// TODO(pascal): Rename that action as it's not opening the internal Stats Page, but the Pôle emploi
// one.
export type OpenStatsPageAction = Readonly<Action<'OPEN_STATS_PAGE'>>
const openStatsPageAction: OpenStatsPageAction = {type: 'OPEN_STATS_PAGE'}

export type RemoveAuthDataAction = Readonly<Action<'REMOVE_AUTH_DATA'>>
const removeAuthDataAction: RemoveAuthDataAction = {type: 'REMOVE_AUTH_DATA'}

type GoToFirstStrategyAction = Readonly<Action<'GO_TO_FIRST_STRATEGY'>>
const goToFirstStrategy: GoToFirstStrategyAction = {type: 'GO_TO_FIRST_STRATEGY'}

// Synchronous action generators, keep them grouped and alpha sorted.
export interface AdviceAction<T extends string> extends ProjectAction<T> {
  readonly advice: bayes.bob.Advice
}

export interface ProjectAction<T extends string> extends Readonly<Action<T>> {
  readonly project: bayes.bob.Project
}

export interface StaticAdviceAction<T extends string> extends Readonly<Action<T>> {
  readonly adviceId: string
}

export interface StrategyAction<T extends string> extends ProjectAction<T> {
  readonly strategyRank?: number
  readonly strategy: bayes.bob.Strategy
}

export type ActionWithId = bayes.bob.Action & {actionId: string}
export type ActionOnAction<T extends string> = Readonly<Action<T>> & {
  action: ActionWithId
  actionDiff?: ActionWithId
}

export interface TipAction<T extends string> extends Readonly<Action<T>> {
  readonly action: {
    readonly actionId: string
  } & bayes.bob.Action
}

export interface VisualElementAction<T extends string> extends Readonly<Action<T>> {
  readonly visualElement: string
}

export interface DetailAction<T extends string> extends Readonly<Action<T>> {
  readonly detail: string
}

export interface ActivateExperimentInFutureAction extends
  Readonly<Action<'WILL_ACTIVATE_EXPERIMENT'>> {
  readonly experiment: keyof bayes.bob.Features
}
function activateExperimentInFuture(experiment: keyof bayes.bob.Features):
ActivateExperimentInFutureAction {
  return {experiment, type: 'WILL_ACTIVATE_EXPERIMENT'}
}

// TODO(cyrille): Maybe deprecate this and create a synthetic event.
type AdviceCardIsShownAction = AdviceAction<'ADVICE_CARD_IS_SHOWN'>

function adviceCardIsShown(project: bayes.bob.Project, advice: bayes.bob.Advice):
AdviceCardIsShownAction {
  return {advice, project, type: 'ADVICE_CARD_IS_SHOWN'}
}

interface LoginModalValues {
  readonly email?: string
  readonly isReturningUser?: boolean
  readonly resetToken?: string
}

interface OpenLoginModalActionBase<T extends string> extends VisualElementAction<T> {
  readonly defaultValues: LoginModalValues
}

interface CloseLoginModalAction extends Readonly<Action<'CLOSE_LOGIN_MODAL'>> {
  readonly hasCanceledLogin?: boolean
}

// TODO(pascal): Check if we need hasCanceledLogin somehow.
function closeLoginModal(unusedHasCanceledLogin?: boolean):
ThunkAction<CloseLoginModalAction, RootState, unknown, AllActions> {
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

export interface DisplayToastMessageAction extends Readonly<Action<'DISPLAY_TOAST_MESSAGE'>> {
  readonly error: string
}

function displayToasterMessage(error: string): DisplayToastMessageAction {
  return {error, type: 'DISPLAY_TOAST_MESSAGE'}
}

type LandingPageSectionIsShownAction = VisualElementAction<'LANDING_PAGE_SECTION_IS_SHOWN'>

function landingPageSectionIsShown(sectionName: string): LandingPageSectionIsShownAction {
  return {type: 'LANDING_PAGE_SECTION_IS_SHOWN', visualElement: sectionName}
}

function modifyProject(project: bayes.bob.Project): ModifyProjectAction {
  return {project, type: 'MODIFY_PROJECT'}
}

type OpenLoginModalAction = OpenLoginModalActionBase<'OPEN_LOGIN_MODAL'>

function openLoginModal(
  defaultValues: LoginModalValues, visualElement: string): OpenLoginModalAction {
  return {defaultValues, type: 'OPEN_LOGIN_MODAL', visualElement}
}

type OpenRegistrationModalAction = OpenLoginModalActionBase<'OPEN_REGISTER_MODAL'>

function openRegistrationModal(defaultValues: LoginModalValues, visualElement: string):
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

export interface OnboardingPageAction extends Readonly<Action<'ONBOARDING_PAGE'>> {
  readonly pathname: string
  readonly project?: bayes.bob.Project
  readonly user?: bayes.bob.User
}
function onboardingPage(
  pathname: string, user: bayes.bob.User, project?: bayes.bob.Project): OnboardingPageAction {
  return {
    pathname,
    project: project ? project : {},
    type: 'ONBOARDING_PAGE',
    user,
  }
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

type StaticAdvicePageIsShownAction = StaticAdviceAction<'STATIC_ADVICE_PAGE_IS_SHOWN'>

function staticAdvicePageIsShown(adviceId: string): StaticAdvicePageIsShownAction {
  return {adviceId: adviceId, type: 'STATIC_ADVICE_PAGE_IS_SHOWN'}
}

type StatsPageIsShownAction = ProjectAction<'STATS_PAGE_IS_SHOWN'>

function statsPageIsShown(project: bayes.bob.Project): StatsPageIsShownAction {
  return {project, type: 'STATS_PAGE_IS_SHOWN'}
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
  readonly utm: bayes.bob.TrackingParameters
}

function trackInitialUtm(utm: bayes.bob.TrackingParameters): TrackInitialUtmAction {
  return {type: 'TRACK_INITIAL_UTM', utm}
}

// Asynchronous action generators.

interface AsyncError {
  readonly error: Error | string
  readonly status: 'error'
}


export type AsyncAction<T extends string, Result> = Readonly<Action<T>> & {
  ASYNC_MARKER: 'ASYNC_MARKER'
  fetchingKey?: string
  ignoreFailure?: boolean
} & ({readonly status?: ''} | AsyncError | {
  readonly response: Result
  readonly status: 'success'
})


interface AsyncStartedAction extends Action<'ASYNC_STARTED'> {
  // TODO(pascal): Maybe try to improve the type of the result.
  promise: Promise<unknown>
}


// Wrap an async function by dispatching an action before and after the
// function: the initial action has the given type and an ASYNC_MARKER, the
// final action has the same type and marker but also a status 'success' or
// 'error' with additional response or error var. The asyncFunc doesn't take
// any parameter and should return a promise.
// The promise returned by this function always resolve, to undefined if
// there's an error.
// TODO(cyrille): Do not call again when the fetchingKey is already fetching.
export function wrapAsyncAction<T extends string, Extra, Result>(
  actionType: T, asyncFunc: () => Promise<Result>, options?: Extra, fetchingKey?: string):
  ThunkAction<Promise<Result|void>, unknown, unknown, Action> {
  return async (dispatch): Promise<Result|void> => {
    const action = {...options, ASYNC_MARKER, fetchingKey, type: actionType}
    dispatch(action)
    try {
      const response = await asyncFunc()
      dispatch({...action, response, status: 'success'})
      return response
    } catch (error) {
      dispatch({...action, error: error as Error, status: 'error'})
    }
  }
}

// Asynchronous actions wrapped with the dispatched actions (see wrapAsyncAction).

export type ComputeActionsForProjectAction =
  AsyncAction<'COMPUTE_ADVICES_FOR_PROJECT', bayes.bob.Actions>

function computeActionsForProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Actions|void>, unknown, unknown, ComputeActionsForProjectAction> {
  return wrapAsyncAction(
    'COMPUTE_ACTIONS_FOR_PROJECT',
    (): Promise<bayes.bob.Actions> => projectComputeActionsPost(user))
}

export type ComputeAdvicesForProjectAction =
  AsyncAction<'COMPUTE_ADVICES_FOR_PROJECT', bayes.bob.Advices>

function computeAdvicesForProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Advices|void>, unknown, unknown, ComputeAdvicesForProjectAction> {
  return wrapAsyncAction(
    'COMPUTE_ADVICES_FOR_PROJECT',
    (): Promise<bayes.bob.Advices> => projectComputeAdvicesPost(user))
}

type ConvertFromProtoAction<Proto> = AsyncAction<'CONVERT_PROTO', Proto>

function convertFromProto<K extends keyof bayes.bob.Reflection>(url: K, proto: string):
ThunkAction<Promise<bayes.bob.Reflection[K] | void>,
unknown, unknown, ConvertFromProtoAction<NonNullable<bayes.bob.Reflection[K]>>> {
  return wrapAsyncAction(
    'CONVERT_PROTO', (): Promise<bayes.bob.Reflection[K]> => convertFromProtoPost(url, proto))
}

export type ConvertToProtoAction = AsyncAction<'CONVERT_PROTO', string>

function convertToProto<K extends keyof bayes.bob.Reflection>(
  url: K, proto: NonNullable<bayes.bob.Reflection[K]>,
): ThunkAction<Promise<string|void>, unknown, unknown, ConvertToProtoAction> {
  return wrapAsyncAction('CONVERT_PROTO', (): Promise<string> =>
    convertToProtoPost(url, proto))
}

export type ListUserEmailsAction = AsyncAction<'LIST_USER_EMAILS', bayes.bob.Campaigns>

function listUserEmails():
ThunkAction<Promise<bayes.bob.Campaigns|void>, RootState, unknown, ListUserEmailsAction> {
  return (dispatch: DispatchAllActions, getState: () => RootState):
  Promise<bayes.bob.Campaigns|void> => {
    const {user, app: {authToken}} = getState()
    return dispatch(wrapAsyncAction(
      'LIST_USER_EMAILS',
      (): Promise<bayes.bob.Campaigns> => listUserEmailsGet(user, ensureAuth(authToken))))
  }
}

type LogoutAction = Readonly<Action<'LOGOUT'>>
function logout(): ThunkAction<Promise<unknown>, unknown, unknown, LogoutAction> {
  return wrapAsyncAction('LOGOUT', logoutPost)
}

type SendUserEmailAction = AsyncAction<'SEND_EMAIL', unknown>

function sendUserEmail(campaignId: string):
ThunkAction<Promise<unknown>, RootState, unknown, SendUserEmailAction> {
  return (dispatch: DispatchAllActions, getState: () => RootState): Promise<unknown> => {
    const {user, app: {authToken}} = getState()
    return dispatch(wrapAsyncAction(
      'SEND_EMAIL',
      (): Promise<unknown> => sendUserEmailPost(user, campaignId, ensureAuth(authToken))))
  }
}

export type GetAdviceTipsAction =
AsyncAction<'GET_ADVICE_TIPS', readonly bayes.bob.Action[]> & {
  advice: bayes.bob.Advice
  project: bayes.bob.Project
}

export function ensureAuth<T>(auth?: T): T {
  if (!auth) {
    throw new Error("L'authentification de la connexion a été perdue")
  }
  return auth
}

function getAdviceTips(project: bayes.bob.Project, advice: bayes.bob.Advice):
ThunkAction<Promise<readonly bayes.bob.Action[]|void>, RootState, unknown, GetAdviceTipsAction> {
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

type GetExpandedCardContentAction<T = unknown> = AsyncAction<'GET_EXPANDED_CARD_CONTENT', T> & {
  advice: bayes.bob.Advice
  project: bayes.bob.Project
}

function getExpandedCardContent<T>(project: bayes.bob.Project, adviceId: string):
ThunkAction<Promise<T|void>, RootState, unknown, GetExpandedCardContentAction<T>> {
  return (dispatch: DispatchAllActions, getState: () => RootState): Promise<T|void> => {
    const {user, app} = getState()
    return dispatch(
      wrapAsyncAction(
        'GET_EXPANDED_CARD_CONTENT',
        () => expandedCardContentGet<T>(user, project, {adviceId}, app.authToken),
        {advice: {adviceId}, project},
        `get-advice-data-${adviceId}`,
      ),
    )
  }
}

type GetJobAction = AsyncAction<'GET_JOBS', bayes.bob.JobGroup> & {
  romeId: string
}

export type RomeJobGroup = bayes.bob.JobGroup & {romeId: string}

function getJobs({romeId}: RomeJobGroup):
ThunkAction<Promise<bayes.bob.JobGroup|void>, unknown, unknown, GetJobAction> {
  return wrapAsyncAction('GET_JOBS', (): Promise<bayes.bob.JobGroup> => jobsGet(romeId), {romeId})
}

type GetApplicationModesAction = AsyncAction<'GET_APPLICATION_MODES', bayes.bob.JobGroup> & {
  romeId: string
}

function fetchApplicationModes({romeId}: RomeJobGroup):
ThunkAction<Promise<bayes.bob.JobGroup|void>, unknown, unknown, GetApplicationModesAction> {
  return wrapAsyncAction(
    'GET_APPLICATION_MODES',
    (): Promise<bayes.bob.JobGroup> => applicationModesGet(romeId),
    {romeId})
}

type GetProjectRequirementsAction =
  AsyncAction<'GET_PROJECT_REQUIREMENTS', bayes.bob.JobRequirements> &
  {project: bayes.bob.Project}

type ProjectWithTargetJobGroup = bayes.bob.Project & {
  targetJob: {jobGroup: RomeJobGroup}
}

function fetchProjectRequirements(project: ProjectWithTargetJobGroup):
ThunkAction<
Promise<bayes.bob.JobRequirements|void>,
unknown, unknown, GetProjectRequirementsAction
> {
  const {targetJob: {jobGroup: {romeId}}} = project
  return wrapAsyncAction(
    'GET_PROJECT_REQUIREMENTS',
    (): Promise<bayes.bob.JobRequirements> => jobRequirementsGet(romeId),
    {project},
  )
}

type GetDiagnosticMainChallengesAction =
  AsyncAction<'GET_DIAGNOSTIC_MAIN_CHALLENGES', bayes.bob.DiagnosticMainChallenges> &
  {key: string}

function getDiagnosticMainChallenges(
  defaultLocale = config.defaultLang, forceAlpha = false,
): ThunkAction<
  Promise<bayes.bob.DiagnosticMainChallenges|void>,
  RootState, unknown, GetDiagnosticMainChallengesAction> {
  return (dispatch, getState): Promise<bayes.bob.DiagnosticMainChallenges|void> => {
    const {
      app: {diagnosticMainChallenges = {}},
      user: {profile: {locale = defaultLocale} = {}, featuresEnabled: {alpha = false} = {}},
    } = getState()
    const key = `${locale || defaultLocale}-${alpha}`
    if (diagnosticMainChallenges[key]) {
      return Promise.resolve(diagnosticMainChallenges[key])
    }
    return dispatch(wrapAsyncAction(
      'GET_DIAGNOSTIC_MAIN_CHALLENGES',
      async (): Promise<bayes.bob.DiagnosticMainChallenges> => {
        return await diagnosticMainChallengesPost({
          featuresEnabled: {alpha: alpha || forceAlpha},
          profile: {locale},
        })
      },
      {key},
    ))
  }
}

type GetMainChallengesUsersCountAction = AsyncAction<
'GET_MAIN_CHALLENGES_USERS_COUNT', bayes.bob.UsersCount>

function getMainChallengesUserCount(): ThunkAction<
Promise<bayes.bob.UsersCount|void>, unknown, unknown, GetMainChallengesUsersCountAction> {
  return wrapAsyncAction(
    'GET_MAIN_CHALLENGES_USERS_COUNT', (): Promise<bayes.bob.UsersCount> => userCountsGet())
}

type DeleteUserAction = AsyncAction<'DELETE_USER_DATA', bayes.bob.User>

function deleteUser(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.User|void>, RootState, unknown, DeleteUserAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {app} = getState()
    return dispatch(wrapAsyncAction(
      'DELETE_USER_DATA', (): Promise<bayes.bob.User> =>
        userDelete(user, ensureAuth(app.authToken))))
  }
}

export type GetUserDataAction = AsyncAction<'GET_USER_DATA', bayes.bob.User>

function fetchUser(userId: string, ignoreFailure: boolean):
ThunkAction<Promise<bayes.bob.User|void>, RootState, unknown, GetUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {authToken} = getState().app
    if (ignoreFailure && !authToken) {
      return Promise.resolve()
    }
    return dispatch(
      wrapAsyncAction(
        'GET_USER_DATA',
        (): Promise<bayes.bob.User> => markUsedAndRetrievePost(userId, ensureAuth(authToken)),
        {ignoreFailure}))
  }
}

type GetAuthTokensAction = AsyncAction<'GET_AUTH_TOKENS', bayes.bob.AuthTokens>

function getAuthTokens():
ThunkAction<Promise<bayes.bob.AuthTokens|void>, RootState, unknown, GetAuthTokensAction> {
  return (dispatch, getState): Promise<bayes.bob.AuthTokens|void> => {
    const {app: {authToken}, user: {userId}} = getState()
    if (!authToken || !userId) {
      return Promise.resolve()
    }
    return dispatch(
      wrapAsyncAction(
        'GET_AUTH_TOKENS',
        (): Promise<bayes.bob.AuthTokens> => authTokensGet(userId, authToken),
      ))
  }
}

type PostUserDataAction = AsyncAction<'POST_USER_DATA', bayes.bob.User>

function saveUser(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.User|void>, RootState, unknown, PostUserDataAction> {
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
ThunkAction<Promise<bayes.bob.QuickDiagnostic|void>, RootState, unknown, DiagnoseOnboardingAction> {
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

type ActivateExperimentsAction = Readonly<Action<'ACTIVATE_EXPERIMENTS'>> & {
  experiments: readonly string[]
}

function activateExperiments(experiments: readonly string[]): ThunkAction<
Promise<bayes.bob.User|void>, RootState, unknown, ActivateExperimentsAction | PostUserDataAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    dispatch({experiments, type: 'ACTIVATE_EXPERIMENTS'})
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
  ThunkAction<Promise<bayes.bob.Project|void>, RootState, unknown, A> {
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
  ThunkAction<Promise<bayes.bob.Advice|void>, RootState, unknown, A> {
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

interface ActionExtra {
  action: ActionWithId
  actionDiff: bayes.bob.Action
  project: bayes.bob.Project
}

function updateAction<
  T extends string, E, A extends AsyncAction<T, bayes.bob.Action> & ActionExtra & E>(
  type: T, project: bayes.bob.Project, action: bayes.bob.Action, actionDiff: bayes.bob.Action,
  options?: E):
  ThunkAction<Promise<bayes.bob.Action|void>, RootState, unknown, A> {
  return (dispatch, getState): Promise<bayes.bob.Action|void> => {
    const {app: {authToken}, user} = getState()
    return dispatch(wrapAsyncAction(
      type,
      (): Promise<bayes.bob.Action> => {
        if (user.userId) {
          return actionPost(user, project, action, actionDiff, ensureAuth(authToken))
        }
        return Promise.resolve({...action, ...actionDiff})
      },
      {action, actionDiff, project, ...options},
    ))
  }
}

type AsyncUpdateAdviceAction<T extends string> = AsyncAction<T, bayes.bob.Advice> & AdviceExtra
type AdvicePageIsShownAction = AsyncUpdateAdviceAction<'ADVICE_PAGE_IS_SHOWN'>

function advicePageIsShown(project: bayes.bob.Project, advice: bayes.bob.Advice):
ThunkAction<Promise<bayes.bob.Advice|void>, RootState, unknown, AdvicePageIsShownAction> {
  return updateAdvice('ADVICE_PAGE_IS_SHOWN', project, advice, {status: 'ADVICE_READ'})
}

type PreviewActionOnAction = ActionOnAction<'PREVIEW_ACTION'>

function previewAction(action: ActionWithId): PreviewActionOnAction {
  return {
    action,
    type: 'PREVIEW_ACTION',
  }
}

type RenameActionPlanAction = AsyncAction<'RENAME_ACTION_PLAN', bayes.bob.Project> & ProjectExtra

function renameProjectActionPlan(project: bayes.bob.Project, newName: string):
ThunkAction<Promise<bayes.bob.Project|void>, RootState, unknown, RenameActionPlanAction> {
  return updateProject('RENAME_ACTION_PLAN', project, {actionPlanName: newName})
}

type ValidateActionPlanStrategyAction = StrategyAction<'VALIDATE_ACTION_PLAN_STRATEGY'>

function validateActionPlanStrategy(project: bayes.bob.Project, strategy: bayes.bob.Strategy):
ValidateActionPlanStrategyAction {
  return {
    project,
    strategy,
    type: 'VALIDATE_ACTION_PLAN_STRATEGY',
  }
}

type ValidateActionPlanAction = ProjectAction<'VALIDATE_ACTION_PLAN'>

function validateActionPlan(project: bayes.bob.Project): ValidateActionPlanAction {
  return {
    project,
    type: 'VALIDATE_ACTION_PLAN',
  }
}

type FinishActionPlanOnboardingAction =
  AsyncAction<'FINISH_ACTION_PLAN_ONBOARDING', bayes.bob.Project> & ProjectExtra
function finishActionPlanOnboarding(project: bayes.bob.Project):
ThunkAction<Promise<bayes.bob.Project|void>, RootState, unknown, FinishActionPlanOnboardingAction> {
  return updateProject('FINISH_ACTION_PLAN_ONBOARDING', project, {
    actionPlanStartedAt: new Date().toISOString(),
  })
}

type SendActionPlanEmailAction = ProjectAction<'SEND_ACTION_PLAN_EMAIL'>
function sendActionPlanEmail(project: bayes.bob.Project & {projectId: string}):
ThunkAction<Promise<boolean|void>, RootState, unknown, SendActionPlanEmailAction> {
  return (dispatch, getState) => {
    const {app: {authToken}, user: {userId}} = getState()
    return dispatch(wrapAsyncAction('SEND_ACTION_PLAN_EMAIL', async () => {
      await actionPlanEmailPost(ensureAuth(userId), project.projectId, ensureAuth(authToken))
      return true
    }, {project}))
  }
}


type AsyncUpdateActionOnAction<T extends string> =
AsyncAction<T, bayes.bob.Action> & ActionOnAction<T> & ActionExtra
type ActionIsShownAction = AsyncUpdateActionOnAction<'ACTION_IS_SHOWN'>

function actionIsShown(project: bayes.bob.Project, action: bayes.bob.Action):
ThunkAction<Promise<bayes.bob.Action|void>, RootState, unknown, ActionIsShownAction> {
  return updateAction('ACTION_IS_SHOWN', project, action, {isResourceShown: true})
}

type ExploreActionAction =
  & AsyncUpdateActionOnAction<'EXPLORE_ACTION'>
  & VisualElementAction<'EXPLORE_ACTION'>
  & {link?: string}
function exploreAction(project: bayes.bob.Project, action: ActionWithId, link: string):
ThunkAction<Promise<bayes.bob.Action|void>, RootState, unknown, ExploreActionAction> {
  const {numExplorations = 0} = action
  return updateAction('EXPLORE_ACTION', project, action, {
    numExplorations: numExplorations + 1,
  }, {
    link,
    visualElement: 'link',
  })
}

type SelectAction = AsyncUpdateActionOnAction<'SELECT_ACTION'>
type UnselectAction = AsyncUpdateActionOnAction<'UNSELECT_ACTION'>

function selectAction(project: bayes.bob.Project, action: ActionWithId, strategyId: string):
ThunkAction<Promise<bayes.bob.Action|void>, RootState, unknown, SelectAction> {
  return updateAction('SELECT_ACTION', project, action, {
    acceptedFromStrategyId: strategyId,
    status: 'ACTION_CURRENT',
  })
}

function unselectAction(project: bayes.bob.Project, action: ActionWithId):
ThunkAction<Promise<bayes.bob.Action|void>, RootState, unknown, UnselectAction> {
  return updateAction('SELECT_ACTION', project, action, {
    acceptedFromStrategyId: '',
    status: 'ACTION_UNREAD',
  })
}

type CompleteActionAction =
AsyncUpdateActionOnAction<'COMPLETE_ACTION'> & VisualElementAction<'COMPLETE_ACTION'>
function completeAction(project: bayes.bob.Project, action: ActionWithId,
  visualElement: 'page'|'plan'):
  ThunkAction<Promise<bayes.bob.Action|void>, RootState, unknown, CompleteActionAction> {
  return updateAction('COMPLETE_ACTION', project, action, {
    status: 'ACTION_DONE',
    stoppedAt: new Date().toISOString(),
  }, {visualElement})
}

type UncompleteActionAction =
AsyncUpdateActionOnAction<'UNCOMPLETE_ACTION'> & VisualElementAction<'UNCOMPLETE_ACTION'>
function uncompleteAction(project: bayes.bob.Project, action: ActionWithId,
  visualElement: 'page'|'plan'):
  ThunkAction<Promise<bayes.bob.Action|void>, RootState, unknown, UncompleteActionAction> {
  return updateAction(
    'UNCOMPLETE_ACTION', project, action, {status: 'ACTION_CURRENT'}, {visualElement},
  )
}

type SaveActionDateAction =
AsyncUpdateActionOnAction<'SAVE_ACTION_DATE'> & VisualElementAction<'SAVE_ACTION_DATE'>
function saveActionDate(project: bayes.bob.Project, action: ActionWithId,
  visualElement: 'page'|'plan', days?: number):
  ThunkAction<Promise<bayes.bob.Action|void>, RootState, unknown, SaveActionDateAction> {
  const completionDate = new Date()
  if (days) {
    completionDate.setDate(completionDate.getDate() + days)
  }
  return updateAction('SAVE_ACTION_DATE', project, action, {
    expectedCompletionAt: completionDate.toISOString(),
    status: 'ACTION_CURRENT',
  }, {visualElement})
}

type OpenActionDateAction = TipAction<'OPEN_ACTION_DATE'> &
ProjectAction<'OPEN_ACTION_DATE'> & VisualElementAction<'OPEN_ACTION_DATE'>
function openActionDate(project: bayes.bob.Project, action: ActionWithId,
  visualElement: 'page'|'plan'): OpenActionDateAction {
  return {
    action,
    project,
    type: 'OPEN_ACTION_DATE',
    visualElement,
  }
}

type ClickExploreActionsAction = ProjectAction<'CLICK_EXPLORE_ACTIONS_ACTION'>
function clickExploreActions(project: bayes.bob.Project): ClickExploreActionsAction {
  return {
    project,
    type: 'CLICK_EXPLORE_ACTIONS_ACTION',
  }
}

type OpenActionDetailAction =
  TipAction<'OPEN_DETAIL_ACTION_ACTION'> & ProjectAction<'OPEN_DETAIL_ACTION_ACTION'>
function openActionDetailAction(project: bayes.bob.Project, action: ActionWithId):
OpenActionDetailAction {
  return {
    action,
    project,
    type: 'OPEN_DETAIL_ACTION_ACTION',
  }
}

type ExpandActionListAction =
ProjectAction<'EXPAND_ACTION_LIST'> & DetailAction<'EXPAND_ACTION_LIST'>
function expandActionList(project: bayes.bob.Project, detail: 'close'|'open'):
ExpandActionListAction {
  return {
    detail,
    project,
    type: 'EXPAND_ACTION_LIST',
  }
}

const ProjectReviews = {
  REVIEW_PROJECT_ACHIEVEMENTS: 'achievements',
  REVIEW_PROJECT_MAIN_CHALLENGE: 'mainChallenge',
  REVIEW_PROJECT_PREVIEW_STRATS: 'strategiesPreview',
} as const
export type ProjectReviewActionType = keyof typeof ProjectReviews
type ProjectReviewAction = AsyncAction<ProjectReviewActionType, bayes.bob.Project> & ProjectExtra

function reviewProject(actionType: ProjectReviewActionType, project: bayes.bob.Project):
ThunkAction<Promise<bayes.bob.Project|void>, RootState, unknown, ProjectReviewAction> {
  const {userHasReviewed} = project
  return updateProject(actionType, project, {userHasReviewed: {
    ...userHasReviewed,
    [ProjectReviews[actionType]]: true,
  }})
}

type ExploreAdviceAction =
  AsyncUpdateAdviceAction<'EXPLORE_ADVICE'> & VisualElementAction<'EXPLORE_ADVICE'>

function exploreAdvice(project: bayes.bob.Project, advice: bayes.bob.Advice, visualElement: string):
ThunkAction<
Promise<bayes.bob.Advice|void>, RootState, unknown, ExploreAdviceAction> {
  return updateAdvice(
    'EXPLORE_ADVICE', project, advice,
    {numExplorations: (advice.numExplorations || 0) + 1},
    {visualElement})
}

type ScoreProjectChallengeAgreementAction =
  AsyncAction<'SCORE_PROJECT_CHALLENGE_AGREEMENT', bayes.bob.Project> & ProjectExtra
function scoreProjectChallengeAgreement(project: bayes.bob.Project, score: number):
ThunkAction<
Promise<bayes.bob.Project|void>, RootState, unknown, ScoreProjectChallengeAgreementAction
> {
  const {feedback} = project
  return updateProject('SCORE_PROJECT_CHALLENGE_AGREEMENT', project, {feedback: {
    ...feedback,
    challengeAgreementScore: score,
  }})
}

export interface WithFeedback {
  feedback: bayes.bob.Feedback
}

export interface WithProjectFeedback {
  feedback: bayes.bob.ProjectFeedback
}

export interface StateForFeedback {
  app: AppState
  user: bayes.bob.User
}

type DispatchFeedbackActions<T extends string> =
  & ThunkDispatch<unknown, unknown, AsyncAction<T, string> & WithFeedback>
  & Dispatch<AllActions>

export function sendFeedback<T extends string, A extends AsyncAction<T, string> & WithFeedback>(
  type: T, source: bayes.bob.FeedbackSource, feedback: bayes.bob.Feedback, t: TFunction,
  extraFields?: Omit<bayes.bob.Feedback, 'source' | 'feedback' | 'userId'>):
  ThunkAction<Promise<unknown|void>, StateForFeedback, unknown, A> {
  return async (dispatch: DispatchFeedbackActions<T>, getState): Promise<unknown|void> => {
    const {user, app} = getState()
    const response = await dispatch(wrapAsyncAction<T, WithFeedback, unknown>(
      type,
      (): Promise<unknown|void> => feedbackPost({
        ...feedback,
        source,
        userId: user.userId,
        ...extraFields,
      }, app.authToken),
      {feedback},
    ))
    if (response) {
      dispatch(displayToasterMessage(t('Merci pour ce retour')))
    }
    return response
  }
}


type SendAdviceFeedbackAction = AsyncAction<'SEND_ADVICE_FEEDBACK', unknown> & WithFeedback

function sendAdviceFeedback(
  {projectId}: bayes.bob.Project = {}, {adviceId}: bayes.bob.Advice = {},
  feedback: bayes.bob.Feedback, t: TFunction, score = 0):
  ThunkAction<Promise<unknown|void>, StateForFeedback, unknown, SendAdviceFeedbackAction> {
  return sendFeedback(
    'SEND_ADVICE_FEEDBACK', 'ADVICE_FEEDBACK', feedback, t, {adviceId, projectId, score})
}

type SendProfessionalFeedbackAction =
  AsyncAction<'SEND_PROFESSIONAL_FEEDBACK', unknown> & WithFeedback

function sendProfessionalFeedback(feedback: bayes.bob.Feedback, t: TFunction):
ThunkAction<Promise<unknown|void>, StateForFeedback, unknown, SendProfessionalFeedbackAction> {
  return sendFeedback('SEND_PROFESSIONAL_FEEDBACK', 'PROFESSIONAL_PAGE_FEEDBACK', feedback, t)
}

type SendProjectFeedbackAction =
  AsyncAction<'SEND_PROJECT_FEEDBACK', bayes.bob.Project> & WithProjectFeedback & ProjectExtra

function sendProjectFeedback(
  project: bayes.bob.Project, feedback: bayes.bob.ProjectFeedback, t: TFunction):
  ThunkAction<
  Promise<bayes.bob.Project|void>, RootState, unknown, SendProjectFeedbackAction> {
  return async (dispatch: DispatchAllActions): Promise<bayes.bob.Project|void> => {
    const response = await dispatch(
      updateProject('SEND_PROJECT_FEEDBACK', project, {feedback}, {feedback}))
    if (response) {
      dispatch(displayToasterMessage(t('Merci pour ce retour\u00A0!')))
    }
    return response
  }
}

type ProjectFeedbackRequestedAction =
  AsyncAction<'PROJET_FEEDBACK_REQUESTED', bayes.bob.Project> & ProjectExtra

function projectFeedbackRequested(project: bayes.bob.Project):
ThunkAction<Promise<bayes.bob.Project|void>, RootState, unknown, ProjectFeedbackRequestedAction> {
  return updateProject('PROJET_FEEDBACK_REQUESTED', project, {wasFeedbackRequested: true})
}

type SendFeedbackVolunteeringAction = AsyncAction<
'SEND_FEEDBACK_VOLUNTEERING', unknown|void>

function sendFeedbackVolunteering(email: string): ThunkAction<
Promise<unknown|void>, unknown, unknown, SendFeedbackVolunteeringAction> {
  return wrapAsyncAction(
    'SEND_FEEDBACK_VOLUNTEERING', (): Promise<unknown|string> =>
      feedbackVolunteeringSend(email, 'Bob'))
}

type StartScoringProjectAction = Readonly<Action<'START_PROJECT_FEEDBACK'>> & WithFeedback & {
  project: bayes.bob.Project
}

function startProjectFeedback(
  project: bayes.bob.Project, score: number): StartScoringProjectAction {
  return {
    feedback: {score},
    project,
    type: 'START_PROJECT_FEEDBACK',
  }
}

export type ReplaceStrategyAction =
AsyncAction<'REPLACE_STRATEGY', bayes.bob.WorkingStrategy> & {
  readonly project: bayes.bob.Project
  readonly strategy: bayes.bob.WorkingStrategy
}

function replaceStrategy(project: bayes.bob.Project, strategy: bayes.bob.WorkingStrategy):
ThunkAction<Promise<bayes.bob.WorkingStrategy|void>, RootState, unknown, ReplaceStrategyAction> {
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
): ThunkAction<Promise<string|void>, RootState, unknown, StopStrategyAction> {
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
    isPersistent?: boolean
    method: AuthenticationMethod
  }

// Export is for test purposes only.
export function asyncAuthenticate(
  authenticate: (request: bayes.bob.AuthRequest) => Promise<bayes.bob.AuthResponse>,
  authRequest: bayes.bob.AuthRequest,
  method: AuthenticationMethod,
  {callback, disconnectOnError, isPersistent}: {
    callback?: (response: bayes.bob.AuthResponse) => bayes.bob.AuthResponse
    disconnectOnError?: boolean
    isPersistent?: boolean
  } = {}): ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AllActions> {
  return async (dispatch, getState): Promise<bayes.bob.AuthResponse|void> => {
    const {app: {authToken, initialFeatures}, user: {hasAccount, hasPassword, userId}} = getState()
    const finalAuthRequest = {
      ...authRequest,
      ...initialFeatures ? {userData: {...initialFeatures, ...authRequest.userData}} : {},
      ...userId &&
        (!hasAccount || method === 'password' && !hasPassword) &&
        !authRequest.authToken ? {authToken, userId} : {},
    }
    const authResponse = await dispatch(wrapAsyncAction(
      'AUTHENTICATE_USER',
      async (): Promise<bayes.bob.AuthResponse> => {
        const response = await authenticate(finalAuthRequest)
        if (callback) {
          return callback(response)
        }
        return response
      },
      {isPersistent: !!isPersistent, method},
    ))
    if (disconnectOnError && !authResponse) {
      // There was an error while connecting, return to a clean authentication state.
      // TODO(cyrille): Handle the case where there's a response with an invalid body.
      dispatch(removeAuthDataAction)
    }
    if (authResponse && authResponse.isServerError) {
      return
    }
    return authResponse
  }
}

interface MockApi {
  userAuthenticate: typeof userAuthenticate
}

function facebookAuthenticateUser(facebookAuth: ReactFacebookLoginInfo, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
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
  }, 'facebook')
}


function googleAuthenticateUser(
  googleAuth: GoogleLoginResponse, mockApi?: MockApi,
): ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {
    googleTokenId: googleAuth.getAuthResponse().id_token,
  }, 'google', {callback: (authResponse: bayes.bob.AuthResponse): bayes.bob.AuthResponse => {
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
  }})
}

function peConnectAuthenticateUser(code: string, nonce: string, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {
    peConnectCode: code,
    peConnectNonce: nonce,
  }, 'peConnect')
}

function linkedInAuthenticateUser(code: string, mockApi?: MockApi):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
  const authenticate = mockApi ? mockApi.userAuthenticate : userAuthenticate
  return asyncAuthenticate(authenticate, {linkedInCode: code}, 'linkedIn')
}

type EmailCheckAction = AsyncAction<'EMAIL_CHECK', bayes.bob.AuthResponse> & {method: string}

function emailCheck(email: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, unknown, unknown, EmailCheckAction> {
  return wrapAsyncAction(
    'EMAIL_CHECK',
    (): Promise<bayes.bob.AuthResponse> => userAuthenticate({email}),
    {method: 'password'})
}

type ChangePasswordAction =
  AsyncAction<'CHANGE_PASSWORD', bayes.bob.AuthResponse> & {method: string}

function changePassword(email: string, oldPassword: string, hashSalt: string, password: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, unknown, unknown, ChangePasswordAction> {
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

function registerNewUser(
  email: string, password: string, firstName: string, isPersistent: boolean,
  userData?: bayes.bob.AuthUserData,
): ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
  const cleanEmail = email.trim()
  return asyncAuthenticate(userAuthenticate, {
    email: cleanEmail,
    firstName: upperFirstLetter(firstName.trim()),
    hashedPassword: sha1(cleanEmail + password),
    userData,
  }, 'password')
}

function silentlyRegisterUser(email: string, isPersistent: boolean, t: TFunction):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
  const cleanEmail = email.trim()
  return asyncAuthenticate(userAuthenticate, {email: cleanEmail}, 'password', {
    callback: response => {
      if (!response.authenticatedUser) {
        throw new Error(t('Cette adresse est déjà utilisée'))
      }
      return response
    },
    isPersistent,
  })
}

function registerNewGuestUser(
  firstName: string, isPersistent: boolean, userData?: bayes.bob.AuthUserData,
): ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
  return asyncAuthenticate(userAuthenticate, {
    firstName: upperFirstLetter(firstName.trim()),
    userData,
  }, 'guest', {disconnectOnError: true, isPersistent})
}

function loginUser(email: string, password: string, hashSalt: string, isPersistent: boolean):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
  const cleanEmail = email.trim()
  return asyncAuthenticate(userAuthenticate, {
    email: cleanEmail,
    hashSalt,
    hashedPassword: sha1(hashSalt + sha1(cleanEmail + password)),
  }, 'password', {isPersistent})
}

function loginUserFromToken(userId: string, authToken: string):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, unknown, unknown, AuthenticateUserAction> {
  return wrapAsyncAction(
    'AUTHENTICATE_USER',
    (): Promise<bayes.bob.AuthResponse> => userAuthenticate({authToken, userId}))
}

type CreateSupportTicketAction = AsyncAction<'CREATE_SUPPORT_TICKET', bayes.bob.SupportTicket>

// TODO(cyrille): Update the local user state to avoid overriding it on global user save.
function createSupportTicket(ticketId: string):
ThunkAction<Promise<unknown|void>, RootState, unknown, CreateSupportTicketAction> {
  return (dispatch, getState): Promise<unknown> => {
    const {app: {authToken}, user: {userId}} = getState()
    return dispatch(wrapAsyncAction('CREATE_SUPPORT_TICKET', (): Promise<unknown> =>
      supportTicketPost(ensureAuth(userId), ensureAuth(authToken), ticketId)))
  }
}

type MigrateUserToAdviceAction = AsyncAction<'MIGRATE_USER_TO_ADVISOR', bayes.bob.User>

function migrateUserToAdvisor():
ThunkAction<Promise<bayes.bob.User|void>, RootState, unknown, MigrateUserToAdviceAction> {
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
ThunkAction<PageIsLoadedAction, RootState, unknown, PageIsLoadedAction> {
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
ThunkAction<Promise<bayes.bob.AuthResponse|void>, unknown, unknown, AuthenticateUserAction> {
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
ThunkAction<Promise<bayes.bob.User|void>, RootState, unknown, SetUserProfileAction>
function setUserProfile<T extends string>(
  userProfile: bayes.bob.UserProfile, shouldAlsoSaveUser: boolean, type: T):
ThunkAction<Promise<bayes.bob.User|void>, RootState, unknown, ProfileAction<T>>
function setUserProfile<T extends string>(
  userProfile: bayes.bob.UserProfile, shouldAlsoSaveUser: boolean, type?: T):
  ThunkAction<
  Promise<bayes.bob.User|void>, RootState, unknown, ProfileAction<T | 'SET_USER_PROFILE'>> {
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
type FinishProjectGoalAction = ProjectAction<'FINISH_PROJECT_GOAL'>
type FinishProjectExperienceAction = ProjectAction<'FINISH_PROJECT_EXPERIENCE'>
type FinishProjectSelfDiagnostic = ProjectAction<'FINISH_PROJECT_SELF_DIAGNOSTIC'>
type EditFirstProjectAction = ProjectAction<'EDIT_FIRST_PROJECT'>
type ModifyProjectAction = ProjectAction<'MODIFY_PROJECT'>

function editFirstProject(newProjectData: bayes.bob.Project, t: TFunction, actionType?: undefined):
ThunkAction<Promise<bayes.bob.User|void>, RootState, unknown, EditFirstProjectAction>
function editFirstProject<T extends string>(
  newProjectData: bayes.bob.Project, t: TFunction, actionType?: T):
ThunkAction<Promise<bayes.bob.User|void>, RootState, unknown, ProjectAction<T>>
function editFirstProject<T extends string>(
  newProjectData: bayes.bob.Project, t: TFunction, actionType?: T):
  ThunkAction<
  Promise<bayes.bob.User|void>, RootState, unknown, ProjectAction<T | 'EDIT_FIRST_PROJECT'>> {
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
Promise<bayes.bob.User|void>, RootState, unknown, CreateProjectAction | CreateProjectSaveAction> {
  return (dispatch, getState): Promise<bayes.bob.User|void> => {
    const {app: {authToken}, user: {projects: [project = {}] = []}} = getState()
    dispatch({project, type: 'CREATE_PROJECT'})
    // Don't use normal saveUser to be able to distinguish between project creation and user saving.
    return dispatch(wrapAsyncAction(
      'CREATE_PROJECT_SAVE',
      (): Promise<bayes.bob.User> => userPost(getState().user, ensureAuth(authToken))))
  }
}

type ResetUserPasswordAction = AsyncAction<'RESET_USER_PASSWORD', unknown>

function askPasswordReset(email: string):
ThunkAction<Promise<string|void>, unknown, unknown, ResetUserPasswordAction> {
  return wrapAsyncAction('RESET_USER_PASSWORD', (): Promise<string> => resetPasswordPost(email))
}

function silentlySetupCoaching(email: string, isPersistent: boolean, t: TFunction):
ThunkAction<Promise<bayes.bob.AuthResponse|void>, RootState, unknown, AuthenticateUserAction> {
  return async (dispatch, getState): Promise<bayes.bob.AuthResponse|void> => {
    const authResponse = await dispatch(silentlyRegisterUser(email, isPersistent, t))
    if (!authResponse) {
      return authResponse
    }
    const {user: {profile: {coachingEmailFrequency = undefined} = {}}} = getState()
    if (coachingEmailFrequency && coachingEmailFrequency !== 'EMAIL_NONE') {
      return authResponse
    }
    const response = await dispatch(setUserProfile({coachingEmailFrequency: 'EMAIL_MAXIMUM'}, true))
    if (response) {
      return authResponse
    }
  }
}

export type GetLocalStatsAction = AsyncAction<'GET_LOCAL_STATS', bayes.bob.LaborStatsData> &
ProjectAction<'GET_LOCAL_STATS'>

function getLaborStats(romeId: string, departementId?: string):
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, unknown, unknown, GetLocalStatsAction>
function getLaborStats(project: bayes.bob.Project):
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, unknown, unknown, GetLocalStatsAction>
function getLaborStats(projectOrRomeId: bayes.bob.Project|string, departementId = ''):
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, unknown, unknown, GetLocalStatsAction> {
  const project: bayes.bob.Project = typeof projectOrRomeId === 'string' ?
    {city: {departementId}, targetJob: {jobGroup: {romeId: projectOrRomeId}}} :
    projectOrRomeId
  const user = {projects: [project]}
  const {
    city: {departementId: dptId = ''} = {},
    targetJob: {jobGroup: {romeId = ''} = {}} = {},
  } = project
  return wrapAsyncAction(
    'GET_LOCAL_STATS', (): Promise<bayes.bob.LaborStatsData> => projectLaborStatsPost(user),
    // TODO(cyrille): Only keep the project departementId and romeId.
    {project},
    `GET_LOCAL_STATS:${romeId}:${dptId}`,
  )
}

type SimulateFocusEmailsAction = AsyncAction<'SIMULATE_FOCUS_EMAILS', bayes.bob.EmailHistory>

function simulateFocusEmails(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.EmailHistory|void>, unknown, unknown, SimulateFocusEmailsAction> {
  return wrapAsyncAction(
    'SIMULATE_FOCUS_EMAILS', (): Promise<bayes.bob.EmailHistory> => simulateFocusEmailsPost(user))
}


// Type of the main dispatch function.
export type DispatchAllActions =
  // Add actions as required.
  ThunkDispatch<RootState, unknown, ActivateExperimentsAction> &
  ThunkDispatch<RootState, unknown, ExploreAdviceAction> &
  ThunkDispatch<RootState, unknown, GetAuthTokensAction> &
  ThunkDispatch<RootState, unknown, GetDiagnosticMainChallengesAction> &
  ThunkDispatch<RootState, unknown, GetUserDataAction> &
  ThunkDispatch<RootState, unknown, ListUserEmailsAction> &
  ThunkDispatch<RootState, unknown, MigrateUserToAdviceAction> &
  ThunkDispatch<RootState, unknown, OpenLoginModalAction> &
  ThunkDispatch<RootState, unknown, PageIsLoadedAction> &
  ThunkDispatch<RootState, unknown, SendProjectFeedbackAction> &
  ThunkDispatch<RootState, unknown, SimulateFocusEmailsAction> &
  Dispatch<AllActions>

export type AllActions =
  | AcceptCookiesUsageAction
  | AcceptPrivacyNoticeAction
  | ActionIsShownAction
  | ActivateExperimentInFutureAction
  | ActivateExperimentsAction
  | AdviceCardIsShownAction
  | AdvicePageIsShownAction
  | AskForAdsCookiesUsageAction
  | AsyncStartedAction
  | AuthenticateUserAction
  | ChangePasswordAction
  | ClearExpiredTokenAction
  | ClickExploreActionsAction
  | CloseLoginModalAction
  | CommentIsShown
  | CompleteActionAction
  | CreateProjectAction
  | CreateProjectSaveAction
  | DeleteUserAction
  | DiagnoseOnboardingAction
  | DisplayToastMessageAction
  | DropOutProjectFeedbackAction
  | EditFirstProjectAction
  | EmailCheckAction
  | ExpandActionListAction
  | ExploreActionAction
  | ExploreAdviceAction
  | FinishActionPlanOnboardingAction
  | FinishProfileFrustrationsAction
  | FinishProfileSettingsAction
  | FinishProfileSituationAction
  | FinishProjectExperienceAction
  | FinishProjectGoalAction
  | FinishProjectSelfDiagnostic
  | GetAdviceTipsAction
  | GetApplicationModesAction
  | GetAuthTokensAction
  | GetDiagnosticMainChallengesAction
  | GetExpandedCardContentAction
  | GetLocalStatsAction
  | CreateSupportTicketAction
  | GetJobAction
  | GetMainChallengesUsersCountAction
  | GetProjectRequirementsAction
  | GetUserDataAction
  | GoToFirstStrategyAction
  | HideToasterMessageAction
  | LandingPageSectionIsShownAction
  | LoadLandingPageAction
  | LogoutAction
  | MigrateUserToAdviceAction
  | ModifyProjectAction
  | OnboardingCommentIsShownAction
  | OnboardingPageAction
  | OpenActionDateAction
  | OpenActionDetailAction
  | OpenLoginModalAction
  | OpenRegistrationModalAction
  | OpenStatsPageAction
  | OpenTipExternalLinkAction
  | PageIsLoadedAction
  | PostUserDataAction
  | PreviewActionOnAction
  | ProjectFeedbackRequestedAction
  | ProjectReviewAction
  | ReadTipAction
  | RemoveAuthDataAction
  | RenameActionPlanAction
  | ReplaceStrategyAction
  | ResetUserPasswordAction
  | SaveActionDateAction
  | ScoreProjectChallengeAgreementAction
  | SeeAdviceAction
  | SendActionPlanEmailAction
  | SendFeedbackVolunteeringAction
  | SendProjectFeedbackAction
  | SelectAction
  | SetUserProfileAction
  | ShareProductModalIsShownAction
  | ShareProductToNetworkAction
  | ShowAllTipsAction
  | SimulateFocusEmailsAction
  | StartAsGuestAction
  | StartScoringProjectAction
  | StartStrategyAction
  | StaticAdvicePageIsShownAction
  | StatsPageIsShownAction
  | StopStrategyAction
  | StrategyWorkPageIsShown
  | TrackInitialUtmAction
  | UnselectAction
  | UncompleteActionAction
  | ValidateActionPlanAction
  | ValidateActionPlanStrategyAction
  | WorkbenchIsShownAction


export type BootstrapAction =
  ComputeAdvicesForProjectAction |
  ConvertToProtoAction |
  ConvertFromProtoAction<bayes.bob.UserWithAdviceSelection> |
  DisplayToastMessageAction |
  SendAdviceFeedbackAction


export interface BootstrapState {
  adviceIds: readonly string[]
  app: AppState
  asyncState: AsyncState<BootstrapAction>
  user: bayes.bob.User
}


export type DispatchBootstrapActions =
  ThunkDispatch<unknown, unknown, ComputeAdvicesForProjectAction> &
  ThunkDispatch<unknown, unknown, ConvertFromProtoAction<bayes.bob.UserWithAdviceSelection>> &
  ThunkDispatch<BootstrapState, unknown, SendAdviceFeedbackAction> &
  (<T extends string, A extends Action<T>>(action: A) => A)


export const noOp = (): void => {
  // Do nothing.
}

export const useDispatch: () => DispatchAllActions = reduxUseDispatch

export {saveUser, hideToasterMessageAction, setUserProfile, fetchUser, clearExpiredTokenAction,
  readTip, facebookAuthenticateUser, sendAdviceFeedback, modifyProject,
  googleAuthenticateUser, emailCheck, registerNewUser, loginUser, logout,
  createFirstProject, fetchProjectRequirements, resetPassword, openStatsPageAction,
  editFirstProject, sendProfessionalFeedback, saveActionDate, isActionForActionPlan,
  displayToasterMessage, closeLoginModal, completeAction, uncompleteAction,
  openLoginModal, acceptCookiesUsageAction,
  loadLandingPage, deleteUser, askPasswordReset, registerNewGuestUser,
  onboardingPage, listUserEmails, validateActionPlanStrategy, unselectAction,
  openTipExternalLink, advicePageIsShown, seeAdvice, validateActionPlan,
  adviceCardIsShown, getAdviceTips, showAllTips, migrateUserToAdvisor, getJobs,
  shareProductToNetwork, trackInitialUtm, exploreAction,
  peConnectAuthenticateUser, sendProjectFeedback, createSupportTicket,
  landingPageSectionIsShown, openRegistrationModal, computeAdvicesForProject,
  getExpandedCardContent, activateExperimentInFuture, activateExperiments,
  loginUserFromToken, shareProductModalIsShown, getAuthTokens, sendActionPlanEmail,
  staticAdvicePageIsShown, linkedInAuthenticateUser, pageIsLoaded,
  isActionRegister, workbenchIsShown, exploreAdvice, diagnoseOnboarding, convertFromProto,
  convertToProto, replaceStrategy, fetchApplicationModes, finishActionPlanOnboarding,
  startStrategy, stopStrategy, removeAuthDataAction, previewAction, selectAction,
  strategyWorkPageIsShown, getLaborStats, sendFeedbackVolunteering,
  startAsGuest, statsPageIsShown, changePassword, silentlyRegisterUser,
  onboardingCommentIsShown, commentIsShown, silentlySetupCoaching,
  getDiagnosticMainChallenges, sendUserEmail, reviewProject, scoreProjectChallengeAgreement,
  getMainChallengesUserCount, simulateFocusEmails, renameProjectActionPlan,
  openActionDate, clickExploreActions, openActionDetailAction, expandActionList,
  goToFirstStrategy, computeActionsForProject, askForAdsCookieUsageAction,
  dropOutProjectFeedbackAction, startProjectFeedback, actionIsShown, projectFeedbackRequested,
}

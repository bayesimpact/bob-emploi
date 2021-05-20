import {GoogleLoginResponse} from 'react-google-login'
import {Action, Dispatch} from 'redux'
import {ThunkAction, ThunkDispatch} from 'redux-thunk'

import {AsyncAction, ComputeAdvicesForProjectAction, ConvertToProtoAction,
  DisplayToastMessageAction, GetLocalStatsAction, ensureAuth, wrapAsyncAction,
  HideToasterMessageAction,
} from 'store/actions'
import {projectDiagnosePost, projectStrategizePost, sendEmailPost} from 'store/api'

import {evalUseCasePoolsGet, evalUseCasesGet, evalFiltersUseCasesPost, useCaseDistributionPost,
  createEvalUseCasePost, getAllMainChallengesPost, saveUseCaseEvalPost,
} from './api'

export interface AuthEvalState {
  fetchGoogleIdToken?: () => Promise<string>
}

export interface EvalAppState {
  pools?: readonly bayes.bob.UseCasePool[]
  useCases?: {
    [poolName: string]: readonly bayes.bob.UseCase[]
  }
}

export interface EvalRootState {
  asyncState: AsyncState<AllEvalActions>
  auth: AuthEvalState
  eval: EvalAppState
}

type DiagnoseProjectAction = AsyncAction<'DIAGNOSE_PROJECT', bayes.bob.Diagnostic>

function diagnoseProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Diagnostic|void>, unknown, unknown, DiagnoseProjectAction> {
  return wrapAsyncAction(
    'DIAGNOSE_PROJECT', (): Promise<bayes.bob.Diagnostic> => projectDiagnosePost(user))
}

function wrapGoogleAuthAction<T extends string, Extra, R>(
  actionType: T,
  asyncFunc: (token: string) => Promise<R>,
  options?: Extra,
): ThunkAction<Promise<void|R>, EvalRootState, unknown, EvalFiltersUseCasesAction> {
  return (dispatch, getState) => {
    const {auth: {fetchGoogleIdToken}} = getState()
    return dispatch(wrapAsyncAction(actionType, async () => {
      const googleIdToken = await ensureAuth(fetchGoogleIdToken)()
      return asyncFunc(googleIdToken)
    }, options))
  }
}

type EvalFiltersUseCasesAction =
  AsyncAction<'GET_EVAL_FILTERS_USE_CASES', readonly bayes.bob.UseCase[]>

function getEvalFiltersUseCases(filters: readonly string[]):
ThunkAction<Promise<readonly bayes.bob.UseCase[]|void>, EvalRootState, unknown,
EvalFiltersUseCasesAction> {
  return wrapGoogleAuthAction(
    'GET_EVAL_FILTERS_USE_CASES',
    googleIdToken => evalFiltersUseCasesPost(filters, googleIdToken),
  )
}

type GetEvalUseCasePoolsAction =
  AsyncAction<'GET_EVAL_USE_CASE_POOLS', readonly bayes.bob.UseCasePool[]>

function getEvalUseCasePools():
ThunkAction<Promise<readonly bayes.bob.UseCasePool[]|void>, EvalRootState, unknown,
GetEvalUseCasePoolsAction> {
  return wrapGoogleAuthAction('GET_EVAL_USE_CASE_POOLS', evalUseCasePoolsGet)
}

type GetEvalUseCasesAction = AsyncAction<'GET_EVAL_USE_CASES', readonly bayes.bob.UseCase[]> & {
  poolName: string
}

function getEvalUseCases(poolName: string): ThunkAction<
Promise<readonly bayes.bob.UseCase[]|void>, EvalRootState, unknown, GetEvalUseCasesAction> {
  return wrapGoogleAuthAction(
    'GET_EVAL_USE_CASES',
    googleIdToken => evalUseCasesGet(poolName, googleIdToken),
    {poolName: poolName},
  )
}

type GetUseCaseDistributionAction =
  AsyncAction<'GET_USE_CASE_DISTRIBUTION', bayes.bob.UseCaseDistribution>

function getUseCaseDistribution(
  categories: readonly bayes.bob.DiagnosticMainChallenge[] = [], maxUseCases: number):
  ThunkAction<
  Promise<bayes.bob.UseCaseDistribution|void>, EvalRootState, unknown,
  GetUseCaseDistributionAction> {
  return wrapGoogleAuthAction(
    'GET_USE_CASE_DISTRIBUTION',
    googleIdToken => useCaseDistributionPost({categories, maxUseCases}, googleIdToken),
  )
}

type GetAllMainChallengesAction =
AsyncAction<'GET_ALL_MAIN_CHALLENGES', bayes.bob.DiagnosticMainChallenges>

function getAllMainChallenges(useCase: bayes.bob.UseCase):
ThunkAction<
Promise<bayes.bob.DiagnosticMainChallenges|void>, EvalRootState, unknown,
GetAllMainChallengesAction> {
  return wrapGoogleAuthAction(
    'GET_ALL_MAIN_CHALLENGES',
    googleIdToken => getAllMainChallengesPost(useCase, googleIdToken),
  )
}

type CreateUseCaseAction = AsyncAction<'CREATE_USE_CASE', bayes.bob.UseCase>

function createUseCase(request: bayes.bob.UseCaseCreateRequest):
ThunkAction<
Promise<bayes.bob.UseCase|void>, EvalRootState, unknown, CreateUseCaseAction> {
  return wrapGoogleAuthAction(
    'CREATE_USE_CASE',
    googleIdToken => createEvalUseCasePost(request, googleIdToken),
  )
}

type SaveUseCaseEvalAction = AsyncAction<'SAVE_USE_CASE_EVAL', unknown> & {
  readonly poolName?: string
  readonly useCaseId: string
  readonly evaluation: bayes.bob.UseCaseEvaluation
}

function saveUseCaseEval(
  useCaseId: string, evaluation: bayes.bob.UseCaseEvaluation, poolName?: string,
): ThunkAction<Promise<unknown>, EvalRootState, unknown, SaveUseCaseEvalAction> {
  return wrapGoogleAuthAction(
    'SAVE_USE_CASE_EVAL',
    googleIdToken => saveUseCaseEvalPost(useCaseId, evaluation, googleIdToken),
    {evaluation, poolName, useCaseId},
  )
}

type SendEmailAction = AsyncAction<'SEND_EMAIL', unknown>

function sendEmail(user: bayes.bob.User, campaignId: string):
ThunkAction<Promise<unknown>, EvalRootState, unknown, SendEmailAction> {
  return wrapGoogleAuthAction(
    'SEND_EMAIL',
    googleIdToken => sendEmailPost(user, campaignId, googleIdToken),
  )
}

type StrategizeProjectAction = AsyncAction<'STRATEGIZE_PROJECT', bayes.bob.Strategies>

function strategizeProject(user: bayes.bob.User):
ThunkAction<Promise<bayes.bob.Strategies|void>, unknown, unknown, StrategizeProjectAction> {
  return wrapAsyncAction(
    'STRATEGIZE_PROJECT', (): Promise<bayes.bob.Strategies> => projectStrategizePost(user))
}

// Type of the eval dispatch function.
export type DispatchAllEvalActions =
  // Add actions as required.
  ThunkDispatch<EvalRootState, unknown, ComputeAdvicesForProjectAction> &
  ThunkDispatch<EvalRootState, unknown, DiagnoseProjectAction> &
  ThunkDispatch<EvalRootState, unknown, CreateUseCaseAction> &
  ThunkDispatch<EvalRootState, unknown, GetEvalUseCasesAction> &
  ThunkDispatch<EvalRootState, unknown, GetEvalUseCasePoolsAction> &
  ThunkDispatch<EvalRootState, unknown, GetLocalStatsAction> &
  ThunkDispatch<EvalRootState, unknown, StrategizeProjectAction> &
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
  | DisplayToastMessageAction
  | EvalAuthAction
  | EvalFiltersUseCasesAction
  | CreateUseCaseAction
  | ConvertToProtoAction
  | GetEvalUseCasesAction
  | GetEvalUseCasePoolsAction
  | GetLocalStatsAction
  | GetUseCaseDistributionAction
  | HideToasterMessageAction
  | SaveUseCaseEvalAction
  | SelectEvalUserAction
  | StrategizeProjectAction


export {
  createUseCase,
  diagnoseProject,
  getAllMainChallenges,
  getEvalFiltersUseCases,
  getEvalUseCasePools,
  getEvalUseCases,
  getUseCaseDistribution,
  saveUseCaseEval,
  sendEmail,
  strategizeProject,
}

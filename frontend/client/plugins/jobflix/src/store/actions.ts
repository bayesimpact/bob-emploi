import {TFunction} from 'i18next'
import {Action, Dispatch} from 'redux'
import {ThunkAction, ThunkDispatch} from 'redux-thunk'

import {AllActions, AsyncAction, HideToasterMessageAction, PageIsLoadedAction, RootState,
  StateForFeedback, VisualElementAction, WithFeedback,
  actionTypesToLog as baseActions, sendFeedback, wrapAsyncAction} from 'store/actions'
import {upskillingSectionsPost, upskillingSectionsMoreJobPost} from 'store/api'

export const actionTypesToLog = {
  ...baseActions,
  SEND_UPSKILLING_FEEDBACK: 'Send feedback',
  UPSKILLING_EXPLORE_JOB: 'Explore a job',
  UPSKILLING_EXPLORE_TRAININGS: 'Explore the trainings',
  UPSKILLING_SECTION_IS_SHOWN: 'A section is shown',
  UPSKILLING_SELECT_JOB: 'Select a job',
  UPSKILLING_SHOW_MORE_INFO: 'Show more job info',
}

type SetLocalUserAction = Readonly<Action<'SET_LOCAL_USER'>> & {
  readonly user: bayes.bob.User
}

function setLocalUser(user: bayes.bob.User): SetLocalUserAction {
  return {
    type: 'SET_LOCAL_USER',
    user,
  }
}


type SendUpskillingFeedbackAction =
  AsyncAction<'SEND_UPSKILLING_FEEDBACK', unknown> & WithFeedback

function sendUpskillingFeedback(feedback: bayes.bob.Feedback, t: TFunction):
ThunkAction<Promise<unknown|void>, StateForFeedback, unknown, SendUpskillingFeedbackAction> {
  return sendFeedback('SEND_UPSKILLING_FEEDBACK', 'UPSKILLING_FEEDBACK', feedback, t)
}

export interface UpskillingAction<T extends string> extends Readonly<Action<T>> {
  job?: bayes.upskilling.Job
  sectionId?: string
}
type GetUpskillingSectionsAction =
AsyncAction<'GET_UPSKILLING_SECTIONS', readonly bayes.upskilling.Section[]> & {
  departementId?: string
}

function getUpskillingSections(departementId?: string): ThunkAction<
Promise<readonly bayes.upskilling.Section[]|void>,
RootState, unknown, GetUpskillingSectionsAction> {
  return (dispatch, getState): Promise<readonly bayes.upskilling.Section[]|void> => {
    const {user} = getState()
    return dispatch(wrapAsyncAction(
      'GET_UPSKILLING_SECTIONS',
      (): Promise<readonly bayes.upskilling.Section[]> => upskillingSectionsPost(user),
      {departementId},
    ))
  }
}

type SelectUpskillingJobAction =
  & UpskillingAction<'UPSKILLING_SELECT_JOB'>
  & VisualElementAction<'UPSKILLING_SELECT_JOB'>
  & {job: ValidUpskillingJob}
  & {isSelected?: boolean}
function selectUpskillingJob(
  visualElement: 'netflix' | 'explorer', job: ValidUpskillingJob,
  sectionId?: string):
  ThunkAction<SelectUpskillingJobAction, RootState, unknown, SelectUpskillingJobAction> {
  return (dispatch, getState) => {
    if (!job) {
      return dispatch({
        job,
        sectionId,
        type: 'UPSKILLING_SELECT_JOB',
        visualElement,
      })
    }
    const {
      app: {
        jobGroupInfos: {[job.jobGroup.romeId]: jobGroupInfo} = {},
        upskillingSelectedJobs = [],
      },
    } = getState()
    const wasSelected = upskillingSelectedJobs.
      some(({jobGroup: {romeId} = {}}) => romeId === job?.jobGroup?.romeId)
    return dispatch({
      isSelected: !wasSelected,
      job: {...job, jobGroup: {...jobGroupInfo, ...job.jobGroup}},
      sectionId,
      type: 'UPSKILLING_SELECT_JOB',
      visualElement,
    })
  }
}

type ExploreUpskillingTrainingsAction =
  & Readonly<Action<'UPSKILLING_EXPLORE_TRAININGS'>>
  & UpskillingAction<'UPSKILLING_EXPLORE_TRAININGS'>
  & VisualElementAction<'UPSKILLING_EXPLORE_TRAININGS'>
function exploreUpskillingTrainings(visualElement: string): ThunkAction<
void|ExploreUpskillingTrainingsAction, RootState, unknown, ExploreUpskillingTrainingsAction> {
  return (dispatch, getState) => {
    const {app} = getState()
    const {upskillingJobExplored: [job, sectionId] = []} = app
    if (!job?.jobGroup?.romeId || !sectionId) {
      // This cannot happen, since the function is fired only when there is an opened job-explorer.
      return
    }
    const {jobGroupInfos: {[job.jobGroup.romeId]: jobGroupInfo = {}} = {}} = app
    return dispatch({
      job: {...job, jobGroup: {...jobGroupInfo, ...job.jobGroup}},
      sectionId,
      type: 'UPSKILLING_EXPLORE_TRAININGS',
      visualElement,
    })
  }
}

interface ExploreUpskillingJobAction extends UpskillingAction<'UPSKILLING_EXPLORE_JOB'> {
  readonly job?: ValidUpskillingJob
  // For easy log in Google Analytics.
  readonly jobName?: string
}
function exploreUpskillingJob(job?: ValidUpskillingJob, sectionId?: string):
ThunkAction<ExploreUpskillingJobAction, RootState, unknown, ExploreUpskillingJobAction> {
  return (dispatch, getState) => {
    if (!job) {
      return dispatch({
        job,
        sectionId,
        type: 'UPSKILLING_EXPLORE_JOB',
      })
    }
    const {app: {jobGroupInfos: {[job.jobGroup.romeId]: jobGroupInfo} = {}}} = getState()
    return dispatch({
      job: {...job, jobGroup: {...jobGroupInfo, ...job.jobGroup}},
      jobName: jobGroupInfo?.samples?.[0]?.name || undefined,
      sectionId,
      type: 'UPSKILLING_EXPLORE_JOB',
    })
  }
}

interface ShowUpskillingSectionAction extends Readonly<Action<'UPSKILLING_SECTION_IS_SHOWN'>> {
  nbJobsShown: number
  sectionId: string
}
function showUpskillingSection(sectionId: string, nbJobsShown: number):
ShowUpskillingSectionAction {
  return {
    nbJobsShown,
    sectionId,
    type: 'UPSKILLING_SECTION_IS_SHOWN',
  }
}

type GetMoreUpskillingSectionJobsAction =
AsyncAction<'UPSKILLING_GET_MORE_JOBS', readonly bayes.upskilling.Job[]> & {
  departementId: string
  section: bayes.upskilling.Section
}
function getMoreUpskillingSectionJobs(departementId: string, section: bayes.upskilling.Section):
ThunkAction<
Promise<readonly bayes.upskilling.Job[]|void>,
RootState, unknown,
GetMoreUpskillingSectionJobsAction> {
  return (dispatch, getState) => {
    const {user} = getState()
    return dispatch(wrapAsyncAction(
      'UPSKILLING_GET_MORE_JOBS',
      (): Promise<readonly bayes.upskilling.Job[]> => upskillingSectionsMoreJobPost(user, section),
      {departementId, section},
    ))
  }
}

type ShowMoreUpskillingInfoAction = UpskillingAction<'UPSKILLING_SHOW_MORE_INFO'>
function showMoreInfo(job: ValidUpskillingJob, sectionId: string):
ThunkAction<ShowMoreUpskillingInfoAction, RootState, unknown, ShowMoreUpskillingInfoAction> {
  return (dispatch, getState) => {
    const {app: {jobGroupInfos: {[job.jobGroup.romeId]: jobGroupInfo = {}} = {}}} = getState()
    return dispatch({
      job: {...job, jobGroup: {...jobGroupInfo, ...job.jobGroup}},
      sectionId,
      type: 'UPSKILLING_SHOW_MORE_INFO',
    })
  }
}

type SetDepartementUpskillingAction = Readonly<Action<'UPSKILLING_SET_DEPARTEMENT'>> & {
  departementId: string
}
function setDepartementUpskillingAction(departementId: string): SetDepartementUpskillingAction {
  return {
    departementId,
    type: 'UPSKILLING_SET_DEPARTEMENT',
  }
}

export type AllUpskillingActions =
  | AllActions
  | ExploreUpskillingJobAction
  | GetUpskillingSectionsAction
  | GetMoreUpskillingSectionJobsAction
  | HideToasterMessageAction
  | PageIsLoadedAction
  | SendUpskillingFeedbackAction
  | SelectUpskillingJobAction
  | SetDepartementUpskillingAction
  | SetLocalUserAction
  | ShowMoreUpskillingInfoAction
  | ShowUpskillingSectionAction


export type DispatchAllUpskillingActions =
  ThunkDispatch<RootState, unknown, GetMoreUpskillingSectionJobsAction> &
  ThunkDispatch<RootState, unknown, PageIsLoadedAction> &
  ThunkDispatch<RootState, unknown, SendUpskillingFeedbackAction> &
  Dispatch<AllUpskillingActions>


export {
  exploreUpskillingJob,
  exploreUpskillingTrainings,
  getMoreUpskillingSectionJobs,
  getUpskillingSections,
  selectUpskillingJob,
  sendUpskillingFeedback,
  setDepartementUpskillingAction,
  setLocalUser,
  showMoreInfo,
  showUpskillingSection,
}

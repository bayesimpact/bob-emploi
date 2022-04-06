import type {TFunction} from 'i18next'
import type {Action, Dispatch} from 'redux'
import type {ThunkAction, ThunkDispatch} from 'redux-thunk'

import type {AllActions, AsyncAction, HideToasterMessageAction, PageIsLoadedAction, RootState,
  StateForFeedback, VisualElementAction, WithFeedback, GetLocalStatsAction} from 'store/actions'
import {actionTypesToLog as baseActions, sendFeedback, wrapAsyncAction,
  getLaborStats as getBobLaborStats} from 'store/actions'
import {upskillingSectionsPost, upskillingSectionsMoreJobPost, upskillingSaveUser} from 'store/api'
import {lowerFirstLetter, upperFirstLetter} from 'store/french'

import ocrSection from '../open_classrooms.json5'
import getLMI4All from './lmi4all'

// TODO(cyrille): Add the prefix programmatically.
export const actionTypesToLog: {[action in AllUpskillingActions['type']]?: string} = {
  ...baseActions,
  SEND_UPSKILLING_FEEDBACK: 'Send feedback',
  UPSKILLING_APPLY_TO_OCR: 'Apply to Open Class Rooms program',
  UPSKILLING_CLOSE_COACHING: 'The coaching modal was just closed',
  UPSKILLING_CLOSE_SELECTION: 'The job evaluation modal was just closed',
  UPSKILLING_COACHING_EMAIL: 'Type email for coaching',
  UPSKILLING_EXPLORE_JOB: 'Explore a job',
  UPSKILLING_EXPLORE_TRAININGS: 'Explore the trainings',
  UPSKILLING_OPEN_COACHING: 'The coaching modal was just opened',
  UPSKILLING_OPEN_SELECTION: 'Select a job',
  UPSKILLING_REGISTER_COACHING: 'Register coaching',
  UPSKILLING_SECTION_IS_SHOWN: 'A section is shown',
  UPSKILLING_SELECT_JOB: 'A job is selected',
  UPSKILLING_SET_CITY: 'An area has been selected',
  UPSKILLING_SHOW_MORE_INFO: 'Show more job info',
}

type ApplyToOpenClassRoomsAction =
  UpskillingAction<'UPSKILLING_APPLY_TO_OCR'> & VisualElementAction<'UPSKILLING_APPLY_TO_OCR'>
const applyToOpenClassRooms = (romeId: string, visualElement: 'discover'|'title'):
ApplyToOpenClassRoomsAction => ({
  job: {jobGroup: {
    ...ocrSection.jobs.find(job => job.jobGroup?.romeId === romeId),
    romeId,
  }},
  sectionId: ocrSection.id,
  type: 'UPSKILLING_APPLY_TO_OCR',
  visualElement,
})

type ClearCityAction = Readonly<Action<'UPSKILLING_CLEAR_CITY'>>
const clearCityAction: ClearCityAction = {type: 'UPSKILLING_CLEAR_CITY'}

type ClearFavoritesAction = Readonly<Action<'UPSKILLING_CLEAR_FAVORITES'>>
const clearFavoritesAction: ClearFavoritesAction = {type: 'UPSKILLING_CLEAR_FAVORITES'}

type CloseCoachingModalAction = Readonly<Action<'UPSKILLING_CLOSE_COACHING'>>
const closeCoachingModalAction: CloseCoachingModalAction =
  {type: 'UPSKILLING_CLOSE_COACHING'}

interface OpenCoachingModalAction extends Readonly<Action<'UPSKILLING_OPEN_COACHING'>> {
  job: ValidUpskillingJob
  sectionId: string
  visualElement: NonNullable<RootState['app']['upskillingJobForCoaching']>[2]
}
const openCoachingModal = (
  job: ValidUpskillingJob,
  sectionId: string,
  visualElement: OpenCoachingModalAction['visualElement'],
): OpenCoachingModalAction => ({
  job,
  sectionId,
  type: 'UPSKILLING_OPEN_COACHING',
  visualElement,
})

type CloseSelectModalAction = Readonly<Action<'UPSKILLING_CLOSE_SELECTION'>>
const closeSelectModalAction: CloseSelectModalAction =
  {type: 'UPSKILLING_CLOSE_SELECTION'}

interface OpenSelectModalAction extends Readonly<Action<'UPSKILLING_OPEN_SELECTION'>> {
  job: ValidUpskillingJob
  sectionId: string
}
const openSelectModal = (job: ValidUpskillingJob, sectionId: string):
OpenSelectModalAction => ({
  job,
  sectionId,
  type: 'UPSKILLING_OPEN_SELECTION',
})

type SetLocalUserAction = Readonly<Action<'SET_LOCAL_USER'>> & {
  readonly user: bayes.bob.User
}

function setLocalUser(user: bayes.bob.User):
ThunkAction<void, RootState, unknown, SetLocalUserAction> {
  const {city} = user.projects?.[0] || {}
  return (dispatch, getState) => {
    if (city?.departementId) {
      const {app: {upskillingIsCityPersistent}} = getState()
      dispatch(setCityUpskillingAction(
        city as bayes.bob.FrenchCity & {departementId: string}, !!upskillingIsCityPersistent))
    }
    dispatch({
      type: 'SET_LOCAL_USER',
      user,
    })
  }
}

type SetLocalUserLocaleAction = Readonly<Action<'SET_LOCAL_USER_LOCALE'>> & {
  readonly locale: string
}

function setLocalUserLocale(locale: string): SetLocalUserLocaleAction {
  return {
    locale,
    type: 'SET_LOCAL_USER_LOCALE',
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
      async (): Promise<readonly bayes.upskilling.Section[]> => {
        const serverSections = await upskillingSectionsPost(user)
        return [
          ...config.hasOCR ? [ocrSection] : [],
          ...serverSections,
        ]
      },
      {departementId},
    ))
  }
}

// Evaluation scores.
export interface JobEvaluation {
  interest?: string
  trainingWill?: string
}
type SelectUpskillingJobAction =
  & UpskillingAction<'UPSKILLING_SELECT_JOB'>
  & VisualElementAction<'UPSKILLING_SELECT_JOB'>
  & {job: ValidUpskillingJob}
  & {isSelected?: boolean}
  & {evaluation?: JobEvaluation}
function selectUpskillingJob(
  visualElement: 'netflix' | 'explorer' | 'coaching', job: ValidUpskillingJob, sectionId: string,
  evaluation?: JobEvaluation):
  ThunkAction<SelectUpskillingJobAction, RootState, unknown, AllUpskillingActions> {
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
      user: {projects},
    } = getState()
    const wasSelected = upskillingSelectedJobs.
      some(({jobGroup: {romeId} = {}}) => romeId === job.jobGroup.romeId)
    const wasCoached = projects?.some(({targetJob: {jobGroup: {romeId = ''} = {}} = {}}) =>
      romeId === job.jobGroup.romeId)
    if (!wasSelected && !wasCoached) {
      dispatch(openCoachingModal(job, sectionId, 'after-save'))
    }
    return dispatch({
      evaluation,
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
  nbJobsShown?: number
  sectionId: string
}
function showUpskillingSection(sectionId: string, nbJobsShown?: number):
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

type SetCityUpskillingAction = AsyncAction<'UPSKILLING_SET_CITY', bayes.bob.FrenchCity> & {
  city: bayes.bob.FrenchCity
  isPersistent: boolean
}

const setCityUpskillingAction = (
  city: bayes.bob.FrenchCity & {departementId: string},
  isPersistent: boolean,
): ThunkAction<Promise<void|bayes.bob.FrenchCity>, RootState, unknown, SetCityUpskillingAction> => {
  return wrapAsyncAction(
    'UPSKILLING_SET_CITY',
    () => Promise.resolve(city),
    {city, isPersistent},
  )
}


interface RegisterCoachingUpskillingAction extends
  UpskillingAction<'UPSKILLING_REGISTER_COACHING'>,
  VisualElementAction<'UPSKILLING_REGISTER_COACHING'> {
  coach: string
  email?: string
}
function registerCoachingUpskillingAction(link?: URL): ThunkAction<
undefined | RegisterCoachingUpskillingAction,
RootState,
unknown,
RegisterCoachingUpskillingAction> {
  return (dispatch, getState) => {
    const {app: {jobGroupInfos = {}, upskillingJobForCoaching}, user: {profile: {email} = {}}} =
      getState()
    if (!upskillingJobForCoaching) {
      return
    }
    const [job, sectionId, visualElement] = upskillingJobForCoaching
    return dispatch({
      coach: link?.hostname || config.productName,
      email,
      job: {...job, jobGroup: {...jobGroupInfos[job.jobGroup.romeId], ...job.jobGroup}},
      sectionId,
      type: 'UPSKILLING_REGISTER_COACHING',
      visualElement,
    })
  }
}

type SaveUpskillingUserAction = AsyncAction<'SAVE_UPSKILLING_USER', void> & {
  readonly user: bayes.bob.User
}

function saveUpskillingUserAction(email: string, job: ValidUpskillingJob, expectation: string):
ThunkAction<Promise<unknown>, RootState, unknown, SaveUpskillingUserAction> {
  return (dispatch, getState): Promise<unknown> => {
    const {app: {jobGroupInfos: {[job.jobGroup.romeId]: jobGroupInfo} = {}}, user} = getState()
    const newUser: bayes.bob.User = {
      ...user,
      profile: {
        ...user?.profile,
        email,
      },
      projects: [{
        city: {departementId: user?.projects?.[0]?.city?.departementId || ''},
        feedback: {text: expectation},
        targetJob: {
          ...jobGroupInfo?.samples?.[0],
          ...job,
        },
      }],
    }
    return dispatch(wrapAsyncAction(
      'SAVE_UPSKILLING_USER',
      (): Promise<unknown> => upskillingSaveUser(newUser),
      {user: newUser},
    ))
  }
}

type TypeCoachingEmailUpskillingAction = UpskillingAction<'UPSKILLING_COACHING_EMAIL'>
function typeCoachingEmailUpskillingAction(sectionId: string, job?: ValidUpskillingJob):
ThunkAction<TypeCoachingEmailUpskillingAction, RootState, unknown,
TypeCoachingEmailUpskillingAction> {
  return (dispatch, getState) => {
    if (!job) {
      return dispatch({
        job,
        sectionId,
        type: 'UPSKILLING_COACHING_EMAIL',
      })
    }
    const {
      app: {
        jobGroupInfos: {[job.jobGroup.romeId]: jobGroupInfo} = {},
      },
    } = getState()
    return dispatch({
      job: {...job, jobGroup: {...jobGroupInfo, ...job.jobGroup}},
      sectionId,
      type: 'UPSKILLING_COACHING_EMAIL',
    })
  }
}

const getLMI4AllLaborStats = (romeId: string):
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, unknown, unknown, GetLocalStatsAction> =>
  wrapAsyncAction(`GET_LOCAL_STATS-${romeId}`, async () => {
    const {add_titles: titles = [], description, qualifications, title} = await getLMI4All(romeId)
    return {jobGroupInfo: {
      description,
      name: title,
      requirements: {diplomas: [{name: qualifications, percentRequired: 100}]},
      samples: titles.map(name => ({
        name: upperFirstLetter(name.split(', ').reverse().map(lowerFirstLetter).join(' ')),
      })),
    }}
  })
const getOCRLaborStats = (romeId: string):
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, unknown, unknown, GetLocalStatsAction> =>
  wrapAsyncAction(`GET_LOCAL_STATS-${romeId}`, () => {
    const {jobGroup, localStats} = ocrSection.jobs.
      find(ocrJob => ocrJob?.jobGroup?.romeId === romeId) || {}
    return Promise.resolve({
      jobGroupInfo: jobGroup,
      localStats: {imt: localStats},
    })
  })
const getLaborStats = (romeId: string, departementId?: string):
ThunkAction<Promise<bayes.bob.LaborStatsData|void>, unknown, unknown, GetLocalStatsAction> => {
  if (config.hasOCR && romeId.startsWith('OCR')) {
    return getOCRLaborStats(romeId)
  }
  if (config.useLMI4All) {
    return getLMI4AllLaborStats(romeId)
  }
  return getBobLaborStats(romeId, departementId)
}

export type AllUpskillingActions =
  | AllActions
  | ApplyToOpenClassRoomsAction
  | ClearCityAction
  | ClearFavoritesAction
  | CloseCoachingModalAction
  | CloseSelectModalAction
  | ExploreUpskillingJobAction
  | ExploreUpskillingTrainingsAction
  | GetMoreUpskillingSectionJobsAction
  | GetUpskillingSectionsAction
  | HideToasterMessageAction
  | OpenCoachingModalAction
  | OpenSelectModalAction
  | PageIsLoadedAction
  | RegisterCoachingUpskillingAction
  | SaveUpskillingUserAction
  | SelectUpskillingJobAction
  | SendUpskillingFeedbackAction
  | SetCityUpskillingAction
  | SetLocalUserAction
  | SetLocalUserLocaleAction
  | ShowMoreUpskillingInfoAction
  | ShowUpskillingSectionAction
  | TypeCoachingEmailUpskillingAction


export type DispatchAllUpskillingActions =
  ThunkDispatch<RootState, unknown, GetMoreUpskillingSectionJobsAction> &
  ThunkDispatch<RootState, unknown, PageIsLoadedAction> &
  ThunkDispatch<RootState, unknown, SendUpskillingFeedbackAction> &
  Dispatch<AllUpskillingActions>


export {
  applyToOpenClassRooms,
  clearCityAction,
  clearFavoritesAction,
  closeCoachingModalAction,
  closeSelectModalAction,
  exploreUpskillingJob,
  exploreUpskillingTrainings,
  getLaborStats,
  getMoreUpskillingSectionJobs,
  getUpskillingSections,
  openCoachingModal,
  openSelectModal,
  registerCoachingUpskillingAction,
  saveUpskillingUserAction,
  selectUpskillingJob,
  sendUpskillingFeedback,
  setCityUpskillingAction,
  setLocalUser,
  setLocalUserLocale,
  showMoreInfo,
  showUpskillingSection,
  typeCoachingEmailUpskillingAction,
}

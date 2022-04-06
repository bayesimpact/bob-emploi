import Storage from 'local-storage-fallback'
import _uniqBy from 'lodash/uniqBy'

import type {AllActions} from 'store/actions'
import {addIfKeyExists, app, appInitialData as baseInitialData, getJsonFromStorage,
  setJsonToStorage} from 'store/app_reducer'

import type {AllUpskillingActions} from './actions'
import {CITY_LOCAL_STORAGE_KEY} from './user_reducer'

// Name of the local storage key to store the upskilling selected jobs.
const UPSKILLING_JOBS_LOCAL_STORAGE_NAME = 'upskilling-selected-jobs'

// Name of the local storage key to store the job evaluations.
const UPSKILLING_JOBS_EVALUATED_LOCAL_STORAGE_NAME = 'upskilling-job-evaluations'

const appInitialData: AppState = {
  ...baseInitialData,
  upskillingCoachingStarted: {},
  upskillingEvaluatedJobs: getJsonFromStorage(UPSKILLING_JOBS_EVALUATED_LOCAL_STORAGE_NAME) || [],
  upskillingIsCityPersistent: !!Storage.getItem(CITY_LOCAL_STORAGE_KEY),
  upskillingJobExplored: undefined,
  // Cache for upskilling sections keyed by departement ID.
  upskillingSections: {},
  upskillingSelectedJobs: getJsonFromStorage(UPSKILLING_JOBS_LOCAL_STORAGE_NAME) || [],
}
export default (state: AppState = appInitialData, action: AllUpskillingActions): AppState => {
  switch (action.type) {
    case 'UPSKILLING_CLEAR_FAVORITES':
      Storage.removeItem(UPSKILLING_JOBS_LOCAL_STORAGE_NAME)
      Storage.removeItem(UPSKILLING_JOBS_EVALUATED_LOCAL_STORAGE_NAME)
      return {
        ...state,
        upskillingEvaluatedJobs: [],
        upskillingSelectedJobs: [],
      }
    case 'GET_UPSKILLING_SECTIONS':
      if (action.status === 'success') {
        return {
          ...state,
          upskillingSections: addIfKeyExists(
            state.upskillingSections,
            action.departementId,
            action.response || [],
          ),
        }
      }
      return state
    case 'UPSKILLING_EXPLORE_JOB':
      return {
        ...state,
        upskillingJobExplored: action.job && action.sectionId && [action.job, action.sectionId] ||
          undefined,
      }
    case 'UPSKILLING_GET_MORE_JOBS':
      if (action.status === 'success' && action.response) {
        const section = (state.upskillingSections?.[action.departementId] || []).find(
          ({id}) => id === action.section.id)
        const jobs = [...(section?.jobs || []), ...action.response]
        return {
          ...state,
          upskillingSectionAllJobs: addIfKeyExists(
            state.upskillingSectionAllJobs,
            action.departementId,
            addIfKeyExists(
              state.upskillingSectionAllJobs?.[action.departementId],
              action.section.id,
              jobs,
            ),
          ),
        }
      }
      break
    case 'UPSKILLING_SELECT_JOB':
      if (action?.job?.jobGroup?.romeId) {
        const thisRomeId = action.job.jobGroup.romeId
        const oldEvaluatedJobs: ValidUpskillingJob[] = getJsonFromStorage(
          UPSKILLING_JOBS_EVALUATED_LOCAL_STORAGE_NAME) || []
        const upskillingEvaluatedJobs = action.evaluation ?
          _uniqBy([...oldEvaluatedJobs, action.job], 'jobGroup.romeId') :
          oldEvaluatedJobs
        setJsonToStorage(UPSKILLING_JOBS_EVALUATED_LOCAL_STORAGE_NAME, upskillingEvaluatedJobs)
        const oldSelection: ValidUpskillingJob[] = getJsonFromStorage(
          UPSKILLING_JOBS_LOCAL_STORAGE_NAME) || []
        const upskillingSelectedJobs = action.isSelected ?
          _uniqBy([...oldSelection, action.job], 'jobGroup.romeId') :
          oldSelection.filter(({jobGroup: {romeId} = {}}) => romeId !== thisRomeId)
        setJsonToStorage(UPSKILLING_JOBS_LOCAL_STORAGE_NAME, upskillingSelectedJobs)
        return {
          ...state,
          upskillingEvaluatedJobs,
          upskillingSelectedJobs,
        }
      }
      return state
    case 'SEND_UPSKILLING_FEEDBACK':
      if (action.status === 'success') {
        return {
          ...state,
          upskillingStarredSections: {
            ...state.upskillingStarredSections,
            // The empty string stands for the feedback from the main page.
            [action.feedback.sectionId || '']: true,
          },
        }
      }
      return state
    case 'UPSKILLING_OPEN_COACHING':
      return {
        ...state,
        upskillingJobForCoaching: [action.job, action.sectionId, action.visualElement],
      }
    case 'UPSKILLING_CLOSE_COACHING':
      return {
        ...state,
        upskillingJobForCoaching: undefined,
      }
    case 'UPSKILLING_OPEN_SELECTION':
      return {
        ...state,
        upskillingEvaluatingJob: [action.job, action.sectionId],
      }
    case 'UPSKILLING_CLOSE_SELECTION':
      return {
        ...state,
        upskillingEvaluatingJob: undefined,
      }
    case 'UPSKILLING_REGISTER_COACHING':
      return {
        ...state,
        upskillingCoachingStarted: {
          ...state.upskillingCoachingStarted,
          [action.job?.jobGroup?.romeId || '']: action.email || '',
        },
      }
    case 'UPSKILLING_SET_CITY':
      return {
        ...state,
        upskillingIsCityPersistent: action.isPersistent,
      }
    case 'UPSKILLING_CLEAR_CITY':
      return {
        ...state,
        upskillingIsCityPersistent: false,
      }
  }
  return app(state, action as AllActions)
}

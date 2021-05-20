import _uniqBy from 'lodash/uniqBy'

import {AllActions} from 'store/actions'
import {addIfKeyExists, app, appInitialData as baseInitialData, getJsonFromStorage,
  setJsonToStorage} from 'store/app_reducer'

import {AllUpskillingActions} from './actions'

// Name of the local storage key to store the upskilling selected jobs.
const UPSKILLING_JOBS_LOCAL_STORAGE_NAME = 'upskilling-selected-jobs'

const appInitialData: AppState = {
  ...baseInitialData,
  upskillingJobExplored: undefined,
  // Cache for upskilling sections keyed by departement ID.
  upskillingSections: {},
  upskillingSelectedJobs: getJsonFromStorage(UPSKILLING_JOBS_LOCAL_STORAGE_NAME) || [],
}
export default (state: AppState = appInitialData, action: AllUpskillingActions): AppState => {
  switch (action.type) {
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
        const oldSelection: ValidUpskillingJob[] = getJsonFromStorage(
          UPSKILLING_JOBS_LOCAL_STORAGE_NAME) || []
        const upskillingSelectedJobs = action.isSelected ?
          _uniqBy([...oldSelection, action.job], 'jobGroup.romeId') :
          oldSelection.filter(({jobGroup: {romeId} = {}}) => romeId !== thisRomeId)
        setJsonToStorage(
          UPSKILLING_JOBS_LOCAL_STORAGE_NAME, upskillingSelectedJobs)
        return {
          ...state,
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
  }
  return app(state, action as AllActions)
}

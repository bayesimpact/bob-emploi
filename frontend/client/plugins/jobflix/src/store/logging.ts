import type {AllActions, RootState} from 'store/actions'
import type {Properties} from 'store/logging'
import {Logger} from 'store/logging'

import type {AllUpskillingActions, UpskillingAction} from './actions'

export default class UpskillingLogger extends Logger {
  public shouldLogAction(action: AllUpskillingActions): boolean {
    if (!super.shouldLogAction(action as AllActions)) {
      return false
    }
    if (action.type === 'UPSKILLING_SELECT_JOB' && !action.isSelected) {
      // Do not log when unselecting a job.
      return false
    }
    if (action.type === 'UPSKILLING_EXPLORE_JOB' && !action.job) {
      return false
    }
    return true
  }

  public getEventName(action: AllUpskillingActions): string {
    if (action.type === 'PAGE_IS_LOADED' && action.location.pathname.startsWith('/accueil')) {
      return 'Upskilling — Welcome Page is loaded'
    }
    return `Upskilling — ${super.getEventName(action as AllActions)}`
  }

  public getEventProperties(action: AllUpskillingActions, state: RootState): Properties {
    const properties: Properties = {}
    if (action.type === 'PAGE_IS_LOADED') {
      const path = action.location.pathname.slice(1)
      if (!path.startsWith('accueil')) {
        properties['Section'] = path
      }
    }
    if (action.type === 'SEND_UPSKILLING_FEEDBACK') {
      if (action.feedback.sectionId) {
        properties['Section'] = action.feedback.sectionId
      }
      properties['Score'] = action.feedback.score || 0
    }
    if (action.type === 'UPSKILLING_SECTION_IS_SHOWN') {
      properties['Section'] = action.sectionId
      if (action.nbJobsShown) {
        properties['Number of jobs shown'] = action.nbJobsShown
      }
    }
    // TODO(sil): This could be more strict.
    if (action.type === 'UPSKILLING_SELECT_JOB' && action.evaluation) {
      if (action.evaluation.interest) {
        properties['Interest for the job'] = action.evaluation.interest
      }
      if (action.evaluation.trainingWill) {
        properties['Training will for the job'] = action.evaluation.trainingWill
      }
    }
    if (action.type === 'UPSKILLING_SET_CITY' && action.city.departementId) {
      properties['Area'] = action.city.departementId
    }
    const upskillingAction = action as UpskillingAction<string>
    if (upskillingAction.sectionId && upskillingAction.job) {
      properties['Section'] = upskillingAction.sectionId
      properties['Job'] = upskillingAction.job.jobGroup?.samples?.[0]?.name ||
        upskillingAction.job?.jobGroup?.romeId || 'unknown'
      if (upskillingAction.job.perks) {
        properties['Badges'] = upskillingAction.job.perks
      }
    }
    if (action.type === 'UPSKILLING_REGISTER_COACHING') {
      properties['Coach'] = action.coach
    }
    return {
      ...super.getEventProperties(action as AllActions, state),
      ...properties,
    }
  }
}

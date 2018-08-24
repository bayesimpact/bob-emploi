import _keyBy from 'lodash/keyBy'
import {FINISH_PROFILE_SITUATION,
  FINISH_PROFILE_FRUSTRATIONS,
  FINISH_PROFILE_SETTINGS,
  FINISH_PROJECT_GOAL, FINISH_PROJECT_CRITERIA,
  FINISH_PROJECT_EXPERIENCE,
  ACCEPT_PRIVACY_NOTICE,
  createFirstProject} from 'store/actions'

import {NEW_PROJECT_ID, Routes} from 'components/url'

import {GeneralStep} from './general'
import {NoticeStep} from './notice'
import {FrustrationsStep} from './frustrations'
import {SettingsStep} from './settings'

import {NewProjectGoalStep} from './goal'
import {NewProjectCriteriaStep} from './criteria'
import {NewProjectExperienceStep} from './experience'
import {NewProjectJobsearchStep} from './jobsearch'


const STEPS = [
  {
    component: NoticeStep,
    doesNotCount: true,
    isBlockingBackwardsNavigation: true,
    name: 'confidentialite',
    path: Routes.PROFILE_PAGE,
    type: ACCEPT_PRIVACY_NOTICE,
  },
  {
    component: GeneralStep,
    name: 'profil',
    path: Routes.PROFILE_PAGE,
    type: FINISH_PROFILE_SITUATION,
  },
  {
    component: NewProjectGoalStep,
    name: 'but',
    path: Routes.NEW_PROJECT_PAGE,
    type: FINISH_PROJECT_GOAL,
  },
  {
    component: NewProjectCriteriaStep,
    name: 'criteres',
    path: Routes.NEW_PROJECT_PAGE,
    type: FINISH_PROJECT_CRITERIA,
  },
  {
    component: NewProjectExperienceStep,
    name: 'experience',
    path: Routes.NEW_PROJECT_PAGE,
    type: FINISH_PROJECT_EXPERIENCE,
  },
  {
    component: NewProjectJobsearchStep,
    name: 'recherche',
    path: Routes.NEW_PROJECT_PAGE,
  },
  {
    component: FrustrationsStep,
    name: 'frustrations',
    path: Routes.PROFILE_PAGE,
    type: FINISH_PROFILE_FRUSTRATIONS,
  },
  {
    component: SettingsStep,
    name: 'preferences',
    path: Routes.PROFILE_PAGE,
    type: FINISH_PROFILE_SETTINGS,
  },
]
// Compute stepNumber for each step.
let nextStepNumber = 1
const NUMBERED_STEPS = _keyBy(
  STEPS.map((step, index) => {
    const stepNumber = nextStepNumber
    if (step.doesNotCount) {
      return {...step, index}
    }
    ++nextStepNumber
    const isLastProjectStep = STEPS.length === index + 1
    return {...step, index, isLastProjectStep, stepNumber}
  }),
  ({path, name}) => `${path}/${name}`)


// Total number of steps in the onboarding.
export const onboardingStepCount = nextStepNumber - 1


function getOnboardingStep(path, name) {
  return NUMBERED_STEPS[`${path}/${name}`] || {}
}


function gotoRelativeStep(path, name, dispatch, history, relativeStep) {
  const {index} = getOnboardingStep(path, name)
  const newStepIndex = index + relativeStep
  if (newStepIndex < 0) {
    return false
  }
  if (newStepIndex >= STEPS.length) {
    dispatch && dispatch(createFirstProject())
    history.push(`${Routes.PROJECT_PAGE}/${NEW_PROJECT_ID}`)
    return false
  }
  const newStep = STEPS[newStepIndex]
  history.push(`${newStep.path}/${newStep.name}`)
  return true
}


function hasPreviousStep(path, name) {
  const {index} = getOnboardingStep(path, name)
  if (!!index && STEPS[index - 1].isBlockingBackwardsNavigation) {
    return false
  }
  return !!index
}


const gotoPreviousStep = (path, name, history) =>
  gotoRelativeStep(path, name, null, history, -1)
const gotoNextStep = (path, name, dispatch, history) =>
  gotoRelativeStep(path, name, dispatch, history, 1)


export {getOnboardingStep, gotoNextStep, gotoPreviousStep, hasPreviousStep}

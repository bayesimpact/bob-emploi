import _ from 'underscore'
import {FINISH_PROFILE_SITUATION,
        FINISH_PROFILE_FRUSTRATIONS,
        FINISH_PROJECT_GOAL, FINISH_PROJECT_CRITERIA,
        FINISH_PROJECT_EXPERIENCE,
        ACCEPT_PRIVACY_NOTICE,
        createFirstProject} from 'store/actions'
import {browserHistory} from 'react-router'

import {NEW_PROJECT_ID, Routes} from 'components/url'

import {GeneralStep} from './general'
import {NoticeStep} from './notice'
import {FrustrationsStep} from './frustrations'

import {NewProjectGoalStep} from './goal'
import {NewProjectCriteriaStep} from './criteria'
import {NewProjectExperienceStep} from './experience'
import {NewProjectJobsearchStep} from './jobsearch'


const STEPS = [
  {
    component: NoticeStep,
    doesNotCount: true,
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
    isLastProjectStep: true,
    name: 'recherche',
    path: Routes.NEW_PROJECT_PAGE,
  },
  {
    component: FrustrationsStep,
    name: 'frustrations',
    path: Routes.PROFILE_PAGE,
    type: FINISH_PROFILE_FRUSTRATIONS,
  },
]
// Compute stepNumber for each step.
let nextStepNumber = 1
const NUMBERED_STEPS = _.indexBy(
  STEPS.map((step, index) => {
    const stepNumber = nextStepNumber
    if (step.doesNotCount) {
      return {...step, index}
    }
    ++nextStepNumber
    return {...step, index, stepNumber}
  }),
  ({path, name}) => `${path}/${name}`)


// Total number of steps in the onboarding.
export const onboardingStepCount = nextStepNumber - 1


function getOnboardingStep(path, name) {
  return NUMBERED_STEPS[`${path}/${name}`] || {}
}


function gotoRelativeStep(path, name, dispatch, relativeStep) {
  const {index} = NUMBERED_STEPS[`${path}/${name}`]
  const newStepIndex = index + relativeStep
  if (newStepIndex < 0) {
    return false
  }
  if (newStepIndex >= STEPS.length) {
    dispatch && dispatch(createFirstProject())
    browserHistory.push(`${Routes.PROJECT_PAGE}/${NEW_PROJECT_ID}`)
    return false
  }
  const newStep = STEPS[newStepIndex]
  browserHistory.push(`${newStep.path}/${newStep.name}`)
  return true
}


const gotoPreviousStep = (path, name) => gotoRelativeStep(path, name, null, -1)
const gotoNextStep = (path, name, dispatch) => gotoRelativeStep(path, name, dispatch, 1)


export {getOnboardingStep, gotoNextStep, gotoPreviousStep}

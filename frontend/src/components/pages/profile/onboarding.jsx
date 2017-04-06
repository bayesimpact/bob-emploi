import {FINISH_PROFILE_SITUATION,
        FINISH_PROFILE_QUALIFICATIONS,
        FINISH_PROFILE_FRUSTRATIONS,
        FINISH_PROJECT_GOAL, FINISH_PROJECT_CRITERIA,
        FINISH_PROJECT_EXPERIENCE,
        ACCEPT_PRIVACY_NOTICE} from 'store/actions'


import {GeneralStep} from './general'
import {NoticeStep} from './notice'
import {GeneralSkillsStep} from './general_skills'
import {FrustrationsStep} from './frustrations'

import {NewProjectGoalStep} from './goal'
import {NewProjectCriteriaStep} from './criteria'
import {NewProjectExperienceStep} from './experience'
import {NewProjectJobsearchStep} from './jobsearch'


const _PROFILE_ONBOARDING_STEPS = [
  {
    component: NoticeStep,
    doesNotCount: true,
    name: 'confidentialite',
    type: ACCEPT_PRIVACY_NOTICE,
  },
  {
    component: GeneralStep,
    name: 'profil',
    type: FINISH_PROFILE_SITUATION,
  },
  {
    component: GeneralSkillsStep,
    name: 'qualifications',
    type: FINISH_PROFILE_QUALIFICATIONS,
  },
  {
    component: FrustrationsStep,
    name: 'frustrations',
    type: FINISH_PROFILE_FRUSTRATIONS,
  },
]
// Compute stepNumber for each step.
let nextStepNumber = 1
export const PROFILE_ONBOARDING_STEPS =
  _PROFILE_ONBOARDING_STEPS.map(step => {
    const stepNumber = nextStepNumber
    if (step.doesNotCount) {
      return step
    }
    ++nextStepNumber
    return {...step, stepNumber}
  })


const _PROJECT_ONBOARDING_STEPS = [
  {
    component: NewProjectGoalStep,
    type: FINISH_PROJECT_GOAL,
  },
  {
    component: NewProjectCriteriaStep,
    type: FINISH_PROJECT_CRITERIA,
  },
  {
    component: NewProjectExperienceStep,
    type: FINISH_PROJECT_EXPERIENCE,
  },
  {
    component: NewProjectJobsearchStep,
  },
]
// Compute stepNumber for each step.
export const PROJECT_ONBOARDING_STEPS =
  _PROJECT_ONBOARDING_STEPS.map(step => {
    const stepNumber = nextStepNumber
    ++nextStepNumber
    return {...step, stepNumber}
  })


// Total number of steps in the onboarding.
export const onboardingStepCount = nextStepNumber - 1

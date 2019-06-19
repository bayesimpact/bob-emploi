import {History} from 'history'
import _keyBy from 'lodash/keyBy'
import {DispatchAllActions,
  FINISH_PROFILE_SITUATION,
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
import {ProfileStepProps, ProjectStepProps} from './step'


interface BaseStep {
  doesNotCount?: boolean
  isBlockingBackwardsNavigation?: boolean
  name: string
  type?: string
}


interface ProfileBaseStep extends BaseStep {
  component: React.ComponentType<ProfileStepProps>
  path: typeof Routes.PROFILE_PAGE
}


interface ProjectBaseStep extends BaseStep {
  component: React.ComponentType<ProjectStepProps>
  path: typeof Routes.NEW_PROJECT_PAGE
}


type AnyOnboardingStep = ProfileBaseStep | ProjectBaseStep

const STEPS: AnyOnboardingStep[] = [
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
interface WithNumber {
  index: number
  isLastProjectStep?: boolean
  stepNumber?: number
}
type NumberedStep = AnyOnboardingStep & WithNumber
let nextStepNumber = 1
const NUMBERED_STEPS = STEPS.map((step: AnyOnboardingStep, index: number): NumberedStep => {
  const stepNumber = nextStepNumber
  if (step.doesNotCount) {
    return {...step, index}
  }
  ++nextStepNumber
  const isLastProjectStep = STEPS.length === index + 1
  return {...step, index, isLastProjectStep, stepNumber}
})


function isProfileStep(step: NumberedStep): step is ProfileBaseStep & WithNumber {
  return step.path === Routes.PROFILE_PAGE
}


const PROFILE_STEPS = _keyBy(
  NUMBERED_STEPS.map((step: NumberedStep): ProfileBaseStep & WithNumber => {
    if (isProfileStep(step)) {
      return step
    }
    return null
  }).filter((step): boolean => !!step),
  'name')


const PRFOJECT_STEPS = _keyBy(
  NUMBERED_STEPS.map((step: NumberedStep): ProjectBaseStep & WithNumber => {
    if (isProfileStep(step)) {
      return null
    }
    return step
  }).filter((step): boolean => !!step),
  'name')


// Total number of steps in the onboarding.
export const onboardingStepCount = nextStepNumber - 1


type OnboardingPath = typeof Routes.PROFILE_PAGE | typeof Routes.NEW_PROJECT_PAGE


function getProjectOnboardingStep(name: string): ProjectBaseStep & WithNumber {
  return PRFOJECT_STEPS[name]
}


function getProfileOnboardingStep(name: string): ProfileBaseStep & WithNumber {
  return PROFILE_STEPS[name]
}


function getOnboardingStep(path: OnboardingPath, name: string): NumberedStep {
  if (path === Routes.PROFILE_PAGE) {
    return getProfileOnboardingStep(name)
  }
  return getProjectOnboardingStep(name)
}


function gotoRelativeStep(
  path: OnboardingPath, name: string, dispatch: DispatchAllActions, history: History,
  relativeStep: number): boolean {
  const currentStep = getOnboardingStep(path, name)
  if (!currentStep) {
    return false
  }
  const {index} = currentStep
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


function hasPreviousStep(path: string, name: string): boolean {
  const currentStep = getOnboardingStep(path, name)
  if (!currentStep) {
    return false
  }
  const {index} = currentStep
  if (!!index && STEPS[index - 1].isBlockingBackwardsNavigation) {
    return false
  }
  return !!index
}


const gotoPreviousStep = (path: string, name: string, history: History): boolean =>
  gotoRelativeStep(path, name, null, history, -1)
const gotoNextStep =
  (path: string, name: string, dispatch: DispatchAllActions, history: History): boolean =>
    gotoRelativeStep(path, name, dispatch, history, 1)


export {getOnboardingStep, gotoNextStep, gotoPreviousStep, hasPreviousStep,
  getProfileOnboardingStep, getProjectOnboardingStep}

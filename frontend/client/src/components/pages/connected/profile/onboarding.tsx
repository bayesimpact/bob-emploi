import {History} from 'history'
import _keyBy from 'lodash/keyBy'
import {useCallback} from 'react'
import {useDispatch, useSelector} from 'react-redux'
import {useHistory} from 'react-router'

import {AllActions, DispatchAllActions, RootState, createFirstProject} from 'store/actions'
import {useSelfDiagnosticInIntro} from 'store/user'

import {NEW_PROJECT_ID, Routes} from 'components/url'

import GeneralStep from './general'
import NoticeStep from './notice'
import FrustrationsStep from './frustrations'
import SettingsStep from './settings'

import NewProjectGoalStep from './goal'
import NewProjectCriteriaStep from './criteria'
import NewProjectExperienceStep from './experience'
import NewProjectJobsearchStep from './jobsearch'
import {SelfDiagnosticStep} from './self_diagnostic'
import {ProfileStepProps, ProjectStepProps} from './step'


interface BaseStep {
  doesNotCount?: boolean
  isBlockingBackwardsNavigation?: boolean
  name: string
  shouldSkip?: (
    project: bayes.bob.Project, featuresEnabled: bayes.bob.Features,
    isSelfDiagnosticInIntro: boolean) => boolean
  type?: AllActions['type']
}


export interface ProfileBaseStep extends BaseStep {
  component: React.ComponentType<ProfileStepProps>
  path: typeof Routes.PROFILE_PAGE
}


export interface ProjectBaseStep extends BaseStep {
  component: React.ComponentType<ProjectStepProps>
  path: typeof Routes.NEW_PROJECT_PAGE
}


type AnyOnboardingStep = ProfileBaseStep | ProjectBaseStep

const STEPS: readonly AnyOnboardingStep[] = [
  {
    component: NoticeStep,
    doesNotCount: true,
    isBlockingBackwardsNavigation: true,
    name: 'confidentialite',
    path: Routes.PROFILE_PAGE,
    type: 'ACCEPT_PRIVACY_NOTICE',
  },
  {
    component: GeneralStep,
    name: 'profil',
    path: Routes.PROFILE_PAGE,
    type: 'FINISH_PROFILE_SITUATION',
  },
  {
    component: NewProjectGoalStep,
    name: 'but',
    path: Routes.NEW_PROJECT_PAGE,
    type: 'FINISH_PROJECT_GOAL',
  },
  {
    component: SelfDiagnosticStep,
    name: 'defi',
    path: Routes.NEW_PROJECT_PAGE,
    shouldSkip: (
      project: unknown, {lateSelfDiagnostic}: bayes.bob.Features, isSelfDiagnosticInIntro: boolean,
    ): boolean =>
      lateSelfDiagnostic === 'ACTIVE' || isSelfDiagnosticInIntro,
    type: 'FINISH_PROJECT_SELF_DIAGNOSTIC',
  },
  {
    component: NewProjectCriteriaStep,
    name: 'criteres',
    path: Routes.NEW_PROJECT_PAGE,
    type: 'FINISH_PROJECT_CRITERIA',
  },
  {
    component: NewProjectExperienceStep,
    name: 'experience',
    path: Routes.NEW_PROJECT_PAGE,
    shouldSkip: ({targetJob}: bayes.bob.Project): boolean => !targetJob,
    type: 'FINISH_PROJECT_EXPERIENCE',
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
    type: 'FINISH_PROFILE_FRUSTRATIONS',
  },
  {
    component: SettingsStep,
    name: 'preferences',
    path: Routes.PROFILE_PAGE,
    type: 'FINISH_PROFILE_SETTINGS',
  },
  {
    component: SelfDiagnosticStep,
    name: 'priorite',
    path: Routes.NEW_PROJECT_PAGE,
    shouldSkip: (
      project: unknown, {lateSelfDiagnostic}: bayes.bob.Features, isSelfDiagnosticInIntro: boolean,
    ): boolean => {
      return lateSelfDiagnostic !== 'ACTIVE' || isSelfDiagnosticInIntro
    },
    type: 'FINISH_PROJECT_SELF_DIAGNOSTIC',
  },
]
// Compute stepNumber for each step.
export interface WithNumber {
  index: number
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
  return {...step, index, stepNumber}
})


function isProfileStep(step: NumberedStep): step is ProfileBaseStep & WithNumber {
  return step.path === Routes.PROFILE_PAGE
}


const PROFILE_STEPS = _keyBy(NUMBERED_STEPS.filter(isProfileStep), 'name')


function isProjectStep(step: NumberedStep): step is ProjectBaseStep & WithNumber {
  return !isProfileStep(step)
}


const PROJECT_STEPS = _keyBy(NUMBERED_STEPS.filter(isProjectStep), 'name')


// Total number of steps in the onboarding.
const onboardingStepCount = nextStepNumber - 1


type OnboardingPath = typeof Routes.PROFILE_PAGE | typeof Routes.NEW_PROJECT_PAGE


function getProjectOnboardingStep(name?: string): ProjectBaseStep & WithNumber | undefined {
  return name && PROJECT_STEPS[name] || undefined
}


function getProfileOnboardingStep(name?: string): ProfileBaseStep & WithNumber | undefined {
  return name && PROFILE_STEPS[name] || undefined
}


function getOnboardingStep(path: OnboardingPath, name: string): NumberedStep | undefined {
  if (path === Routes.PROFILE_PAGE) {
    return getProfileOnboardingStep(name)
  }
  return getProjectOnboardingStep(name)
}


function gotoRelativeStep(
  path: OnboardingPath, name: string, dispatch: DispatchAllActions|undefined, history: History,
  relativeStep: 1|-1, project: bayes.bob.Project, featuresEnabled: bayes.bob.Features,
  isSelfDiagnosticInIntro: boolean): boolean {
  const currentStep = getOnboardingStep(path, name)
  if (!currentStep) {
    return false
  }
  const {index} = currentStep
  let newStepIndex: number
  for (
    newStepIndex = index + relativeStep;
    newStepIndex >= 0 && newStepIndex < STEPS.length;
    newStepIndex += relativeStep
  ) {
    const newStep = STEPS[newStepIndex]
    if (newStep.shouldSkip?.(project, featuresEnabled, isSelfDiagnosticInIntro)) {
      continue
    }
    history.push(`${newStep.path}/${newStep.name}`)
    return true
  }
  if (newStepIndex >= STEPS.length) {
    dispatch?.(createFirstProject())
    history.push(`${Routes.PROJECT_PAGE}/${NEW_PROJECT_ID}`)
  }
  return false
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


function hasNextStep(
  currentStep: WithNumber, project: bayes.bob.Project, featuresEnabled: bayes.bob.Features,
  isSelfDiagnosticInIntro: boolean): boolean {
  const {index} = currentStep
  for (const nextStep of STEPS.slice(index + 1)) {
    if (!nextStep.shouldSkip?.(project, featuresEnabled, isSelfDiagnosticInIntro)) {
      return true
    }
  }
  return false
}


interface OnboardingProps<T extends BaseStep> {
  goBack: (() => void) | undefined
  goNext: () => void
  hasNextStep: boolean
  step: T & WithNumber | undefined
  stepCount: number
}


const emptyObject = {} as const


function useOnboarding<T extends BaseStep>(
  getStep: (name?: string) => T & WithNumber | undefined, path: string, name?: string,
): OnboardingProps<T> {
  const history = useHistory()
  const dispatch = useDispatch<DispatchAllActions>()
  const step = getStep(name)
  const project = useSelector(
    ({user: {projects}}: RootState): bayes.bob.Project => projects?.[0] || emptyObject,
  )
  const featuresEnabled = useSelector(
    ({user: {featuresEnabled}}: RootState): bayes.bob.Features => featuresEnabled || emptyObject,
  )
  const isSelfDiagnosticInIntro = useSelfDiagnosticInIntro()
  const goNext = useCallback((): void => {
    name && gotoRelativeStep(path, name, dispatch, history, 1, project, featuresEnabled,
      isSelfDiagnosticInIntro)
  }, [path, name, dispatch, history, project, featuresEnabled, isSelfDiagnosticInIntro])
  const goBack = useCallback((): void => {
    name && gotoRelativeStep(path, name, undefined, history, -1, project, featuresEnabled,
      isSelfDiagnosticInIntro)
  }, [path, name, history, project, featuresEnabled, isSelfDiagnosticInIntro])
  return {
    goBack: name && hasPreviousStep(path, name) ? goBack : undefined,
    goNext,
    hasNextStep: !!step && hasNextStep(step, project, featuresEnabled, isSelfDiagnosticInIntro),
    // TODO(pascal): Fix step numbering depending on skipped steps.
    step: step?.shouldSkip?.(project, featuresEnabled, isSelfDiagnosticInIntro) ? undefined : step,
    stepCount: onboardingStepCount,
  }
}


function useProfileOnboarding(name?: string): OnboardingProps<ProfileBaseStep> {
  return useOnboarding(getProfileOnboardingStep, Routes.PROFILE_PAGE, name)
}


function useProjectOnboarding(name?: string): OnboardingProps<ProjectBaseStep> {
  return useOnboarding(getProjectOnboardingStep, Routes.PROJECT_PAGE, name)
}

export {useProfileOnboarding, useProjectOnboarding}

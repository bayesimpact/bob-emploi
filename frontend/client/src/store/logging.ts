import {detect} from 'detect-browser'

import type {AdviceAction, AllActions, AsyncAction, AuthenticateUserAction, ActionOnAction,
  DetailAction, DisplayToastMessageAction, GetUserDataAction, LoadLandingPageAction,
  OnboardingPageAction, PageIsLoadedAction, ProjectAction, RootState, StrategyAction, TipAction,
  VisualElementAction, WithProjectFeedback, StaticAdviceAction} from './actions'
import {isActionRegister, isActionForActionPlan} from './actions'
import isMobileVersion from './mobile'


export const daysSince = (timestamp: number | string): number => {
  const day = new Date(timestamp)
  day.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - day.getTime()) / 86_400_000)
}


const getUser = (action: AllActions, state: RootState): bayes.bob.User => {
  if (state.user && state.user.userId) {
    return state.user
  }
  const getUserAction = action as GetUserDataAction & {readonly response: bayes.bob.User}
  if (getUserAction.response) {
    const userResponse = getUserAction.response
    if (userResponse.userId) {
      return userResponse
    }

    const authAction =
      action as AuthenticateUserAction & {readonly response: bayes.bob.AuthResponse}
    const authResponse = authAction.response
    if (authResponse.authenticatedUser && authResponse.authenticatedUser.userId) {
      return authResponse.authenticatedUser
    }
  }
  return state.user || {}
}

export interface Properties {
  [feature: string]: string | readonly string[] | boolean | number
}

const flattenFeatureFlags = (featuresEnabled: bayes.bob.Features): Properties => {
  const features: Properties = {}
  const boolFeatures: string[] = []
  for (const feature in featuresEnabled) {
    const featureValue = featuresEnabled[feature as keyof bayes.bob.Features]
    if (featureValue === true) {
      boolFeatures.push(feature)
    } else if (featureValue) {
      features['Features.' + feature] = featureValue
    }
  }
  features['Features'] = boolFeatures.sort()
  return features
}


export class Logger {
  private actionTypesToLog: {[actionType: string]: string}

  private browser: {name?: string} = detect() || {}

  public constructor(actionTypesToLog: {[actionType: string]: string}) {
    this.actionTypesToLog = actionTypesToLog
  }

  public shouldLogAction(action: AllActions): boolean {
    if (!this.actionTypesToLog[action.type]) {
      return false
    }
    const asyncAction = action as AsyncAction<string, void>
    if (asyncAction.ASYNC_MARKER && !asyncAction.status) {
      // For async action, log only when the action returns ie when status is here.
      return false
    }
    return true
  }

  public getEventName(action: AllActions): string {
    if (isActionRegister(action)) {
      return this.actionTypesToLog['REGISTER_USER']
    }
    if (action.type === 'ONBOARDING_PAGE') {
      return `${this.actionTypesToLog[action.type] || action.type} ${action.pathname}`
    }
    return this.actionTypesToLog[action.type]
  }

  public getEventProperties(action: AllActions, state: RootState): Properties {
    const properties: Properties = {}
    if (this.browser.name) {
      properties['$browser'] = this.browser.name
    }
    if (isMobileVersion) {
      properties['Mobile Version'] = true
    }
    if (action.type === 'PAGE_IS_LOADED') {
      const path = action.location.pathname.slice(1)
      properties['path'] = path
    }
    const user = getUser(action, state)
    if (user.registeredAt) {
      properties['Days since Registration'] = daysSince(user.registeredAt)
    }
    if (user.userId && !user.hasAccount) {
      properties['Is Guest'] = true
    }
    if (user.featuresEnabled) {
      Object.assign(properties, flattenFeatureFlags(user.featuresEnabled))
    }
    const loadLandingPageAction = action as LoadLandingPageAction
    if (loadLandingPageAction.landingPageKind) {
      properties['Feature.landingPage'] = loadLandingPageAction.landingPageKind
      if (loadLandingPageAction.defaultProjectProps &&
          loadLandingPageAction.defaultProjectProps.targetJob &&
          loadLandingPageAction.defaultProjectProps.targetJob.masculineName) {
        properties['Landing Page Specific Job Name'] =
          loadLandingPageAction.defaultProjectProps.targetJob.masculineName
      }
    }
    // TODO(cyrille): Decide whether we should keep this one or 'Action' property.
    const tipAction = action as TipAction<string>
    if (tipAction.action && tipAction.action.title) {
      properties['Action Title'] = tipAction.action.title
    }
    const feedbackAction = action as WithProjectFeedback
    if (feedbackAction.feedback) {
      const {actionPlanBetterPreparedScore, actionPlanHelpsPlanScore,
        actionPlanUsefulnessScore, score, text} = feedbackAction.feedback
      if (actionPlanUsefulnessScore && actionPlanHelpsPlanScore &&
        actionPlanBetterPreparedScore && text) {
        properties['Feedback Action plan Is useful score'] = actionPlanUsefulnessScore
        properties['Feedback Action plan Helps to plan score'] = actionPlanHelpsPlanScore
        properties['Feedback Action plan Better prepared score'] = actionPlanBetterPreparedScore
        properties['Feedback Action plan Want to see text'] = text
      }
      if (score) {
        properties['Score'] = score
      }
    }
    const projectAction = action as ProjectAction<string>
    if (projectAction.project) {
      const {city, diagnostic, originalSelfDiagnostic, targetJob} = projectAction.project
      const {masculineName = ''} = targetJob || {}
      if (masculineName) {
        properties['Project Job Name'] = masculineName
      }
      const {name: cityName = ''} = city || {}
      if (cityName) {
        properties['Project City'] = cityName
      }
      const {categoryId = ''} = diagnostic || {}
      if (categoryId) {
        properties['Bob Thinks'] = categoryId
      }
      if (categoryId && originalSelfDiagnostic?.categoryId) {
        properties["Bob Thinks matches user's self diagnostic"] =
          categoryId === originalSelfDiagnostic?.categoryId
      }
      if (action.type === 'SCORE_PROJECT_CHALLENGE_AGREEMENT') {
        const {feedback: {challengeAgreementScore} = {}} = action.projectDiff
        if (challengeAgreementScore) {
          properties['Main Challenge Agreement Score'] = challengeAgreementScore - 1
        }
      }
    }
    const adviceAction = action as AdviceAction<string>
    if (adviceAction.advice && adviceAction.advice.adviceId) {
      properties['Advice'] = adviceAction.advice.adviceId
      if (adviceAction.advice.numStars) {
        properties['Advice Star Count'] = adviceAction.advice.numStars
      }
      if (adviceAction.project && adviceAction.project.advices) {
        properties['Advice Card Count'] = adviceAction.project.advices.length
        properties['Advice Position'] = adviceAction.project.advices.findIndex(
          (advice): boolean => advice.adviceId === adviceAction.advice.adviceId) + 1
      }
      if (adviceAction.advice.score) {
        properties['Advice Score'] = adviceAction.advice.score
      }
    }
    const errorAction = action as DisplayToastMessageAction
    if (errorAction.error) {
      properties['Error'] = errorAction.error
    }
    const asyncAction = action as {readonly status: 'error' | 'sending' | 'success'}
    if (asyncAction.status) {
      properties['Async response'] = asyncAction.status
    }
    const visualElementAction = action as VisualElementAction<string>
    if (visualElementAction.visualElement) {
      properties['Visual Element Source'] = visualElementAction.visualElement
    }
    const staticAdviceAction = action as StaticAdviceAction<string>
    if (staticAdviceAction.adviceId) {
      properties['Advice ID'] = staticAdviceAction.adviceId
    }
    const pageIsLoadedAction = action as PageIsLoadedAction
    if (pageIsLoadedAction.timeToFirstInteractiveMillisecs) {
      properties['Page loading time (ms)'] = pageIsLoadedAction.timeToFirstInteractiveMillisecs
    }
    const strategyAction = action as StrategyAction<string>
    if (strategyAction.strategy && strategyAction.strategy.strategyId) {
      properties['Strategy'] = strategyAction.strategy.strategyId
      if (strategyAction.strategyRank) {
        properties['Strategy Rank'] = strategyAction.strategyRank
      }
      if (strategyAction.strategy.isPrincipal) {
        properties['Is Main Strategy'] = strategyAction.strategy.isPrincipal
      }
      const selectedActionsCount =
        strategyAction.project.actions?.filter(({acceptedFromStrategyId}) =>
          acceptedFromStrategyId === strategyAction.strategy.strategyId).length
      if (typeof selectedActionsCount === 'number') {
        properties['Strategy Action Count'] = selectedActionsCount
      }
    }
    const actionOnAction = action as ActionOnAction<string>
    if (actionOnAction.action?.actionId) {
      properties['Action'] = actionOnAction.action.actionId
    }
    if (actionOnAction.action?.acceptedFromStrategyId) {
      properties['Strategy'] = actionOnAction.actionDiff?.acceptedFromStrategyId ||
        actionOnAction.action.acceptedFromStrategyId
    }
    if (action.type === 'EXPLORE_ACTION' && action.link) {
      properties['Target URL'] = action.link
    }
    if (isActionForActionPlan(action)) {
      properties['Project Action Count'] =
        action.project.actions?.
          filter(({status}) => status === 'ACTION_CURRENT' || status === 'ACTION_DONE').length || 0
    }
    const detailAction = action as DetailAction<string>
    if (action.type === 'EXPAND_ACTION_LIST' && detailAction.detail) {
      properties['Expand action'] = detailAction.detail
    }
    const onboardingAction = action as OnboardingPageAction
    if (onboardingAction.user && onboardingAction.user.profile) {
      if (onboardingAction.user.profile.locale) {
        properties['Can Tutoie'] = onboardingAction.user.profile.locale.indexOf('@tu') > 0
      }
      if (onboardingAction.user.profile.gender) {
        properties['Gender'] = onboardingAction.user.profile.gender
      }
      if (onboardingAction.user.profile.yearOfBirth) {
        properties['Year of Birth'] = onboardingAction.user.profile.yearOfBirth
        properties['Age'] = new Date().getFullYear() - onboardingAction.user.profile.yearOfBirth
      }
      if (onboardingAction.user.profile.familySituation) {
        properties['Family Situation'] = onboardingAction.user.profile.familySituation
      }
      if (onboardingAction.user.profile.highestDegree) {
        properties['Highest Degree'] = onboardingAction.user.profile.highestDegree
      }
      if (onboardingAction.user.profile.hasCarDrivingLicense) {
        properties['Has Car Driving License'] = onboardingAction.user.profile.hasCarDrivingLicense
      }
      if (onboardingAction.user.profile.frustrations) {
        properties['Frustrations'] = onboardingAction.user.profile.frustrations
      }
      if (onboardingAction.user.profile.origin) {
        properties['Origin'] = onboardingAction.user.profile.origin
      }
      if (onboardingAction.user.profile.coachingEmailFrequency) {
        properties['Coaching Email Freq.'] = onboardingAction.user.profile.coachingEmailFrequency
      }
    }
    if (onboardingAction.project) {
      if (onboardingAction.project.hasClearProject) {
        properties['Has clear project'] = onboardingAction.project.hasClearProject
      }
      if (onboardingAction.project.targetJob) {
        if (onboardingAction.project.targetJob.name) {
          properties['Target Job Name'] = onboardingAction.project.targetJob.name
        }
        if (onboardingAction.project.targetJob.jobGroup &&
          onboardingAction.project.targetJob.jobGroup.name) {
          properties['Target Job Group Name'] = onboardingAction.project.targetJob.jobGroup.name
        }
      }
      if (onboardingAction.project.areaType) {
        properties['Area type'] = onboardingAction.project.areaType
      }
      if (onboardingAction.project.city) {
        if (onboardingAction.project.city.regionName) {
          properties['Region name'] = onboardingAction.project.city.regionName
        }
        if (onboardingAction.project.city.urbanScore) {
          properties['Urban score'] = onboardingAction.project.city.urbanScore
        }
      }
      if (onboardingAction.project.employmentTypes) {
        properties['Employment Types'] = onboardingAction.project.employmentTypes
      }
      if (onboardingAction.project.workloads) {
        properties['Workloads'] = onboardingAction.project.workloads
      }
      if (onboardingAction.project.minSalary) {
        properties['Min Salary'] = onboardingAction.project.minSalary
      }
      if (onboardingAction.project.previousJobSimilarity) {
        properties['Previous Job Similarity'] = onboardingAction.project.previousJobSimilarity
      }
      if (onboardingAction.project.seniority) {
        properties['Seniority'] = onboardingAction.project.seniority
      }
      if (onboardingAction.project.trainingFulfillmentEstimate) {
        properties['Training Fulfillment Estimate'] =
          onboardingAction.project.trainingFulfillmentEstimate
      }
      if (onboardingAction.project.networkEstimate) {
        properties['Network Estimate'] = onboardingAction.project.networkEstimate
      }
      if (typeof onboardingAction.project.jobSearchHasNotStarted === 'boolean') {
        properties['Job Search Not Started'] = onboardingAction.project.jobSearchHasNotStarted
        if (onboardingAction.project.jobSearchStartedAt) {
          properties['Job Search Started Date'] = onboardingAction.project.jobSearchStartedAt
        }
      }
      if (onboardingAction.project.weeklyOffersEstimate) {
        properties['Weekly Offers'] = onboardingAction.project.weeklyOffersEstimate
      }
      if (onboardingAction.project.weeklyApplicationsEstimate) {
        properties['Weekly Applications'] = onboardingAction.project.weeklyApplicationsEstimate
      }
      if (onboardingAction.project.totalInterviewCount) {
        properties['Number of Interviews'] = onboardingAction.project.totalInterviewCount
      }
      if (onboardingAction.project.originalSelfDiagnostic) {
        if (onboardingAction.project.originalSelfDiagnostic.categoryId) {
          properties['Main Challenge Self Diagnostic'] =
            onboardingAction.project.originalSelfDiagnostic.categoryId
        }
        if (onboardingAction.project.originalSelfDiagnostic.status &&
          onboardingAction.project.originalSelfDiagnostic.status === 'OTHER_SELF_DIAGNOSTIC' &&
          onboardingAction.project.originalSelfDiagnostic.categoryDetails) {
          properties['Main Challenge Self Diagnostic Other'] =
            onboardingAction.project.originalSelfDiagnostic.categoryDetails
        }
      }
    }
    return properties
  }

  public getUserId(action: AllActions, state: RootState): string|undefined {
    return getUser(action, state).userId
  }

  public getUserProperties(action: AllActions, state: RootState): Properties|null {
    const {featuresEnabled, profile} = getUser(action, state)

    const {
      email = '',
      gender = '',
      highestDegree = '',
      situation = '',
      yearOfBirth = 0,
    } = profile || {}
    const profileData: Properties = {}
    profileData['$hostname'] = window.location.hostname
    if (gender) {
      profileData['Gender'] = gender
    }
    if (highestDegree) {
      profileData['Highest Degree'] = highestDegree
    }
    if (situation) {
      profileData['Situation'] = situation
    }
    if (yearOfBirth) {
      profileData['Year Of Birth'] = yearOfBirth
    }
    if (/@(bayes.org|example.com|bayesimpact.org)$/.test(email)) {
      profileData['Is Test User?'] = true
    }
    if (featuresEnabled) {
      Object.assign(profileData, flattenFeatureFlags(featuresEnabled))
    }
    if (!Object.keys(profileData)) {
      return null
    }
    return profileData
  }
}

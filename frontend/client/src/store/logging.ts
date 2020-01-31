import {detect} from 'detect-browser'

import {AdviceAction, AllActions, AsyncAction, AuthenticateUserAction, DisplayToastMessageAction,
  GetUserDataAction, LoadLandingPageAction, PageIsLoadedAction, ProjectAction, RootState,
  StrategyAction, TipAction, VisualElementAction, WithFeedback, isActionRegister} from './actions'


export const daysSince = (timestamp: number | string): number => {
  const day = new Date(timestamp)
  day.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - day.getTime()) / 86400000)
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

interface Properties {
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

  public getEventName(action: {response?: {isNewUser?: boolean}; type: string}): string {
    if (isActionRegister(action)) {
      return this.actionTypesToLog['REGISTER_USER']
    }
    return this.actionTypesToLog[action.type]
  }

  public getEventProperties(action: AllActions, state: RootState): Properties {
    const properties: Properties = {}
    if (this.browser.name) {
      properties['$browser'] = this.browser.name
    }
    properties['$hostname'] = window.location.hostname
    if (state.app && state.app.isMobileVersion) {
      properties['Mobile Version'] = true
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
    const tipAction = action as TipAction<string>
    if (tipAction.action && tipAction.action.title) {
      properties['Action Title'] = tipAction.action.title
    }
    const feedbackAction = action as WithFeedback
    if (feedbackAction.feedback) {
      const {feedback, score} = feedbackAction.feedback
      if (feedback) {
        properties['Feedback'] = feedback
      }
      if (score) {
        properties['Score'] = score
      }
    }
    const projectAction = action as ProjectAction<string>
    if (projectAction.project) {
      const {city, diagnostic, targetJob} = projectAction.project
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

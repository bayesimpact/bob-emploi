import {detect} from 'detect-browser'

import {REGISTER_USER, isActionRegister} from './actions'


export const daysSince = timestamp => {
  const day = new Date(timestamp)
  day.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - day.getTime()) / 86400000)
}


const getUser = (action, state) => {
  if (state.user && state.user.userId) {
    return state.user
  }
  if (!action.response) {
    return {}
  }
  if (action.response.userId) {
    return action.response
  }
  if (action.response.authenticatedUser && action.response.authenticatedUser.userId) {
    return action.response.authenticatedUser
  }
  return {}
}


const flattenFeatureFlags = featuresEnabled => {
  const features = {}
  const boolFeatures = []
  for (const feature in featuresEnabled) {
    if (featuresEnabled[feature] === true) {
      boolFeatures.push(feature)
    } else {
      features['Features.' + feature] = featuresEnabled[feature]
    }
  }
  features['Features'] = boolFeatures.sort()
  return features
}


export class Logger {
  constructor(actionTypesToLog) {
    this.actionTypesToLog = actionTypesToLog
    this.browser = detect()
  }

  shouldLogAction(action) {
    if (!this.actionTypesToLog[action.type]) {
      return false
    }
    if (action.ASYNC_MARKER && !action.status) {
      // For async action, log only when the action returns ie when status is here.
      return false
    }
    return true
  }

  getEventName(action) {
    if (isActionRegister(action)) {
      return this.actionTypesToLog[REGISTER_USER]
    }
    return this.actionTypesToLog[action.type]
  }

  getEventProperties(action, state) {
    const properties = {}
    if (this.browser && this.browser.name) {
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
    if (user.featuresEnabled) {
      Object.assign(properties, flattenFeatureFlags(user.featuresEnabled))
    }
    if (action.landingPageKind) {
      properties['Feature.landingPage'] = action.landingPageKind
      if (action.defaultProjectProps && action.defaultProjectProps.targetJob) {
        properties['Landing Page Specific Job Name'] =
          action.defaultProjectProps.targetJob.masculineName
      }
    }
    if (action.action) {
      properties['Action Title'] = action.action.title
    }
    if (action.feedback) {
      const {caption, score, text} = action.feedback
      if (caption || text) {
        properties['Feedback'] = caption || text
      }
      if (score) {
        properties['Score'] = score
      }
    }
    if (action.notification) {
      properties['Notification'] = action.notification
    }
    if (action.project) {
      const {
        targetJob: {masculineName} = {},
        mobility: {city: {name: cityName} = {}} = {},
      } = action.project
      if (masculineName) {
        properties['Project Job Name'] = masculineName
      }
      if (cityName) {
        properties['Project City'] = cityName
      }
    }
    if (action.advice && action.advice.adviceId) {
      properties['Advice'] = action.advice.adviceId
      if (action.advice.numStars) {
        properties['Advice Star Count'] = action.advice.numStars
      }
      if (action.project && action.project.advices) {
        properties['Advice Card Count'] = action.project.advices.length
        properties['Advice Position'] = action.project.advices.findIndex(
          advice => advice.adviceId === action.advice.adviceId) + 1
      }
      if (action.advice.score || action.score) {
        // advice.score is the current score of the advice if it has been
        // scored before the action; action.score is the new one if the action
        // is the scoring action.
        properties['Advice Score'] = action.score || action.advice.score
        if (action.score !== action.advice.score) {
          properties['Previous Advice Score'] = action.advice.score || 0
        }
      }
    }
    if (action.helperAction) {
      properties['Action to help'] = action.helperAction
    }
    if (action.feature) {
      properties['Feature'] = action.feature
    }
    if (action.likeScore) {
      properties['Like Score'] = action.likeScore
    }
    if (action.error) {
      properties['Error'] = action.error
    }
    if (action.status) {
      properties['Async response'] = action.status
    }
    if (action.visualElement) {
      properties['Visual Element Source'] = action.visualElement
    }
    const restrictJobGroup =
      action.props && action.props.restrictJobGroup ||
      action.options && action.options.restrictJobGroup
    if (restrictJobGroup) {
      properties['Restricted Jog Group Name'] = restrictJobGroup.name
      properties['Restricted Jog Group ROME ID'] = restrictJobGroup.romeId
    }
    if (action.timeToFirstInteractiveMillisecs) {
      properties['Page loading time (ms)'] = action.timeToFirstInteractiveMillisecs
    }
    return properties
  }

  getUserId(action, state) {
    return getUser(action, state).userId
  }

  getUserProperties(action, state) {
    const {featuresEnabled, profile} = getUser(action, state)
    if (!profile) {
      return null
    }

    const {email, gender, highestDegree, situation, yearOfBirth} = profile
    const profileData = {}
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
    return profileData
  }
}

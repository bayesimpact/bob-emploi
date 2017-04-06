import browser from 'detect-browser'
import moment from 'moment'

import {AUTHENTICATE_USER, REFRESH_ACTION_PLAN, REGISTER_USER, STICK_ACTION} from './actions'
import {upperFirstLetter} from './french'
import {isAnyActionPlanGeneratedRecently} from './project'


const daysSince = timestamp => {
  const day = moment(timestamp).startOf('day')
  const today = moment().startOf('day')
  return Math.round(today.diff(day, 'days'))
}


const getUser = (action, state) => {
  if (state.user.userId) {
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
  }

  shouldLogAction(action) {
    if (!this.actionTypesToLog[action.type]) {
      return false
    }
    if (action.ASYNC_MARKER && !action.status) {
      // For async action, log only when the action returns ie when status is here.
      return false
    }
    if (action.type === REFRESH_ACTION_PLAN) {
      if (!isAnyActionPlanGeneratedRecently(action.response.projects)) {
        // The Refresh Action Plan action had no effect.
        return false
      }
    }
    return true
  }

  getEventName(action) {
    if (action.type === AUTHENTICATE_USER) {
      if (action.response && action.response.isNewUser) {
        return this.actionTypesToLog[REGISTER_USER]
      }
    }
    return this.actionTypesToLog[action.type]
  }

  getEventProperties(action, state) {
    const properties = {}
    if (browser.name) {
      properties['$browser'] = browser.name
    }
    if (state.app.isMobileVersion) {
      properties['Mobile Version'] = true
    }
    const user = getUser(action, state)
    if (user.registeredAt) {
      properties['Days since Registration'] = daysSince(user.registeredAt)
    }
    if (user.featuresEnabled) {
      Object.assign(properties, flattenFeatureFlags(user.featuresEnabled))
    }
    if (action.action) {
      properties['Action Title'] = action.action.title
    }
    if (action.type === STICK_ACTION) {
      properties['Action Closed as'] = 'Sticky'
    } else if (action.feedback) {
      if (action.feedback.caption) {
        properties['Feedback'] = action.feedback.caption
      }
      let status
      if (action.feedback.status) {
        // ACTION_DECLINED -> Declined
        status = action.feedback.status.substr('ACTION_'.length)
        status = upperFirstLetter(status.toLowerCase())
      } else if (action.feedback.good) {
        status = 'Useful'
      } else {
        status = 'Not useful'
      }
      properties['Action Closed as'] =  status
    }
    if (action.project) {
      properties['Project Job Name'] = action.project.targetJob.masculineName
      properties['Project City'] = action.project.mobility.city.name
    }
    if (action.advice && action.advice.adviceId) {
      properties['Advice'] = action.advice.adviceId
      if (action.advice.numStars) {
        properties['Advice Star Count'] = action.advice.numStars
      }
      if (action.advicePriority) {
        properties['Advice Priority'] = action.advicePriority
      }
      if (action.project && action.project.advices) {
        properties['Advice Card Count'] = action.project.advices.length
      }
      if (action.advice.score) {
        properties['Advice Score'] = action.score || action.advice.score
        if (action.score !== action.advice.score) {
          properties['Previous Advice Score'] = action.advice.score || 0
        }
      }
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
      action.options &&  action.options.restrictJobGroup
    if (restrictJobGroup) {
      properties['Restricted Jog Group Name'] = restrictJobGroup.name
      properties['Restricted Jog Group ROME ID'] = restrictJobGroup.romeId
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
    if (profile.latestJob) {
      profileData['Last Job Group ROME ID'] = profile.latestJob.jobGroup.romeId
      profileData['Last Job Name'] = profile.latestJob.masculineName
    }
    if (featuresEnabled) {
      Object.assign(profileData, flattenFeatureFlags(featuresEnabled))
    }
    return profileData
  }
}

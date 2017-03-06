import moment from 'moment'

import {hasActionPlan} from 'store/project'

function shouldShowFirstWelcomeBackScreen(user) {
  // This could also be done without moment.
  const userRegistrationMoment = moment(user.registeredAt)
  const hoursSinceRegistration = moment().diff(userRegistrationMoment, 'hours')
  const hasSeenFirstWelcomeBack = user.interactions && user.interactions.hasSeenFirstWelcomeBack
  return hasActionPlan(user) && hoursSinceRegistration >= 12 && !hasSeenFirstWelcomeBack
}

function shouldShowSecondWelcomeBackScreen(user) {
  // This could also be done without moment.
  const userLastRequestedDataMoment = moment(user.requestedByUserAtDate)
  const daysSinceLastUserRequest = moment().diff(userLastRequestedDataMoment, 'days')
  const hasSeenSecondWelcomeBack = user.interactions && user.interactions.hasSeenSecondWelcomeBack
  return hasActionPlan(user) && daysSinceLastUserRequest >= 10 && !hasSeenSecondWelcomeBack
}

function onboardingComplete(user) {
  if (!user || !user.profile) {
    return false
  }
  const {email, gender, name, city, yearOfBirth, latestJob, situation,
         highestDegree, lastName,
         englishLevelEstimate, officeSkillsEstimate} = user.profile
  const hasProject = (user.projects || []).some(project => !project.isIncomplete)
  return !!(gender && name && city && yearOfBirth && situation &&
      email && highestDegree && lastName && latestJob &&
      englishLevelEstimate && officeSkillsEstimate && hasProject)
}

const mainSelector = function(state) {
  return {
    ...state,
    user: {
      ...state.user,
      onboardingComplete: state.user && onboardingComplete(state.user),
    },
  }
}


export {shouldShowFirstWelcomeBackScreen,
        shouldShowSecondWelcomeBackScreen, mainSelector, onboardingComplete}

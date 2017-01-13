import moment from 'moment'

import {hasActionPlan} from 'store/project'

function isFirstActionPlanReadyToBeCreated(user) {
  if (!user.projects || user.projects.length !== 1 || user.deletedProjects) {
    // Not enough or too many projects.
    return false
  }
  const project = user.projects[0]
  return !project.actions && !project.pastActions
}

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

function onboardingComplete(profile) {
  if (!profile) {
    return false
  }
  const {email, gender, name, city, yearOfBirth, latestJob, situation,
         highestDegree, lastName,
         englishLevelEstimate, officeSkillsEstimate, contractTypeFlexibility,
         geographicalFlexibility, professionalFlexibility, salaryRequirementFlexibility,
         trainingFlexibility} = profile
  return !!(gender && name && city && yearOfBirth && situation &&
      email && highestDegree && lastName && latestJob &&
      englishLevelEstimate && officeSkillsEstimate && contractTypeFlexibility &&
      geographicalFlexibility && professionalFlexibility && salaryRequirementFlexibility &&
      trainingFlexibility)
}

const mainSelector = function(state) {
  return {
    ...state,
    user: {
      ...state.user,
      onboardingComplete: state.user && onboardingComplete(state.user.profile),
    },
  }
}


export {isFirstActionPlanReadyToBeCreated, shouldShowFirstWelcomeBackScreen,
        shouldShowSecondWelcomeBackScreen, mainSelector, onboardingComplete}

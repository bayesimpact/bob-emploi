import React from 'react'

// TODO: Remove flexibilities after the deprecated fields got removed from the
// user.proto.
const USER_PROFILE_FIELDS = {
  city: React.PropTypes.object,
  contractTypeFlexibility: React.PropTypes.string,
  drivingLicenses: React.PropTypes.arrayOf(React.PropTypes.string.isRequired),
  email: React.PropTypes.string.isRequired,
  englishLevelEstimate: React.PropTypes.number,
  frustrations: React.PropTypes.arrayOf(React.PropTypes.string.isRequired),
  gender: React.PropTypes.string,
  geographicalFlexibility: React.PropTypes.string,
  highestDegree: React.PropTypes.string,
  lastName: React.PropTypes.string.isRequired,
  latestJob: React.PropTypes.object,
  name: React.PropTypes.string.isRequired,
  officeSkillsEstimate: React.PropTypes.number,
  professionalFlexibility: React.PropTypes.string,
  salaryRequirementFlexibility: React.PropTypes.string,
  situation: React.PropTypes.string,
  trainingFlexibility: React.PropTypes.string,
  yearOfBirth: React.PropTypes.number,
}
const USER_PROFILE_SHAPE = React.PropTypes.shape(USER_PROFILE_FIELDS)

function hasActivelySearchingSinceIfNeeded(activelySearchingSince, jobSearchPhase) {
  return !!(activelySearchingSince || jobSearchPhase === 'PASSIVE')

}

function recursivelyUpdateDates(root, delta) {
  if (!root) {
    return root
  }
  if (typeof root === 'string') {
    if (!/^\d+-\d+-\d+T\d+:\d+:[\d.]+Z$/.test(root)) {
      return root
    }
    const d = new Date(root)
    if (isNaN(d.valueOf())) {
      return root
    }
    return new Date(d.getTime() + delta).toISOString()
  }
  if (typeof root !== 'object') {
    return root
  }
  if (Object.prototype.toString.call(root) === '[object Array]') {
    root.forEach((value, i) => {
      root[i] = recursivelyUpdateDates(value, delta)
    })
    return root
  }
  for (const key in root) {
    root[key] = recursivelyUpdateDates(root[key], delta)
  }
  return root
}

function travelInTime(user, delta) {
  return recursivelyUpdateDates(user, delta)
}


function userAge(yearOfBirth) {
  const todayYear = (new Date()).getFullYear()
  return todayYear - yearOfBirth
}


export {hasActivelySearchingSinceIfNeeded, travelInTime, USER_PROFILE_FIELDS, USER_PROFILE_SHAPE,
        userAge}

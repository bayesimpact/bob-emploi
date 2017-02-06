import React from 'react'

// TODO: Remove frustrations and flexibilities after the deprecated fields got removed from the
// user.proto.
const USER_PROFILE_SHAPE = React.PropTypes.shape({
  city: React.PropTypes.object,
  contractTypeFlexibility: React.PropTypes.string,
  email: React.PropTypes.string.isRequired,
  frustrations: React.PropTypes.arrayOf(React.PropTypes.string.isRequired),
  gender: React.PropTypes.string,
  geographicalFlexibility: React.PropTypes.string,
  lastName: React.PropTypes.string.isRequired,
  latestJob: React.PropTypes.object,
  name: React.PropTypes.string.isRequired,
  professionalFlexibility: React.PropTypes.string,
  salaryRequirementFlexibility: React.PropTypes.string,
  situation: React.PropTypes.string,
  trainingFlexibility: React.PropTypes.string,
  yearOfBirth: React.PropTypes.number,
})

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


export {hasActivelySearchingSinceIfNeeded, travelInTime, USER_PROFILE_SHAPE}

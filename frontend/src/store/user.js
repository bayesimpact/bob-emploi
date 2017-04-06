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
  hasHandicap: React.PropTypes.bool,
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

// Return true if the user could be discriminated against because he is too young.
function isYoungAndDiscriminated(profile) {
  return (profile.frustrations || []).indexOf('AGE_DISCRIMINATION') >= 0 &&
      userAge(profile.yearOfBirth) < 30
}

// Return true if the user could be discriminated against because he is too young.
function isOldAndDiscriminated(profile) {
  return (profile.frustrations || []).indexOf('AGE_DISCRIMINATION') >= 0 &&
      userAge(profile.yearOfBirth) > 40
}

// Returns a list of all frustrations of a user, as tags.
// TODO(guillaume): Pull directly from Airtable when we know for sure the shape.
function getUserFrustrationTags(profile) {
  const maybeE = profile.gender === 'FEMININE' ? 'e': ''
  const frustrationsToTag = {
    AGE_DISCRIMINATION: 'Discriminations (âge)',
    ATYPIC_PROFILE: 'Profile atypique',
    HANDICAPED: 'Handicap non adapté',
    INTERVIEW: "Entretiens d'embauche",
    MOTIVATION: `Rester motivé${maybeE}`,
    NO_OFFERS: "Pas assez d'offres",
    NO_OFFER_ANSWERS: 'Pas assez de réponses',
    RESUME: 'Rédaction CVs et lettres de motivation',
    SEX_DISCRIMINATION: 'Discriminations (H/F)',
    SINGLE_PARENT: 'Situation familiale compliquée',
    TIME_MANAGEMENT: 'Gestion de mon temps',
    TRAINING: 'Formations professionnelles',
  }
  return (profile.frustrations || []).filter(
    f => frustrationsToTag[f]).map(f => frustrationsToTag[f])
}

// A function that returns a description for a degree.
// If no degree, we do not return any a description.
function getHighestDegreeDescription(userProfile) {
  const degreeToText = {
    BAC_BACPRO: 'Bac professionnel',
    BTS_DUT_DEUG: 'BTS - DUT - DEUG',
    CAP_BEP: 'CAP - BEP',
    DEA_DESS_MASTER_PHD: 'DEA - DESS - Master - PhD',
    LICENCE_MAITRISE: 'Licence - Maîtrise',
  }
  return degreeToText[userProfile.highestDegree]
}


export {hasActivelySearchingSinceIfNeeded, getUserFrustrationTags, travelInTime,
        USER_PROFILE_FIELDS, USER_PROFILE_SHAPE, userAge, isYoungAndDiscriminated,
        isOldAndDiscriminated, getHighestDegreeDescription}

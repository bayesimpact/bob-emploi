import PropTypes from 'prop-types'
import {FamilySituation} from 'api/user'

// TODO: Remove situation after the deprecated fields got removed from the
// user.proto.
const USER_PROFILE_FIELDS = {
  city: PropTypes.object,
  drivingLicenses: PropTypes.arrayOf(PropTypes.string.isRequired),
  email: PropTypes.string.isRequired,
  englishLevelEstimate: PropTypes.number,
  familySituation: PropTypes.oneOf(Object.keys(FamilySituation)),
  frustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
  gender: PropTypes.string,
  hasHandicap: PropTypes.bool,
  highestDegree: PropTypes.string,
  lastName: PropTypes.string.isRequired,
  latestJob: PropTypes.object,
  name: PropTypes.string.isRequired,
  officeSkillsEstimate: PropTypes.number,
  situation: PropTypes.string,
  yearOfBirth: PropTypes.number,
}
const USER_PROFILE_SHAPE = PropTypes.shape(USER_PROFILE_FIELDS)

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
    ATYPIC_PROFILE: 'Profil atypique',
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


const DEGREE_OPTIONS = [
  {name: '--', value: 'NO_DEGREE'},
  {name: 'CAP - BEP', value: 'CAP_BEP'},
  {name: 'Bac - Bac Pro', value: 'BAC_BACPRO'},
  {name: 'BTS - DUT - DEUG', value: 'BTS_DUT_DEUG'},
  {name: 'Licence - Maîtrise', value: 'LICENCE_MAITRISE'},
  {name: 'DEA - DESS - Master - PhD', value: 'DEA_DESS_MASTER_PHD'},
]


// A function that returns a description for a degree.
// If no degree, we do not return any a description.
function getHighestDegreeDescription(userProfile) {
  if(userProfile.highestDegree === 'NO_DEGREE') {
    // Exception where we do not want to show the option's name.
    return
  }
  const {name} = DEGREE_OPTIONS.find(({value}) => value === userProfile.highestDegree) || {}
  return name
}


// Returns a list of options for family situation depending on gender.
function getFamilySituationOptions(gender) {
  return [
    {name: 'Célibataire', value: 'SINGLE'},
    {name: 'En couple', value: 'IN_A_RELATIONSHIP'},
    {name: 'Famille avec enfants', value: 'FAMILY_WITH_KIDS'},
    {
      name:
        `${gender === 'FEMININE' ? 'Mère' :
          gender === 'MASCULINE' ? 'Père' : 'Parent'} seul${gender === 'FEMININE' ? 'e' : ''}`,
      value: 'SINGLE_PARENT_SITUATION',
    },
  ]
}


export {getUserFrustrationTags, travelInTime, USER_PROFILE_FIELDS,
        USER_PROFILE_SHAPE, userAge, isYoungAndDiscriminated,
        isOldAndDiscriminated, getHighestDegreeDescription,
        getFamilySituationOptions, DEGREE_OPTIONS}

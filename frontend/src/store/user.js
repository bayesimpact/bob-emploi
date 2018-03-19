import PropTypes from 'prop-types'

// TODO: Remove situation after the deprecated fields got removed from the
// user.proto.
const USER_PROFILE_FIELDS = {
  city: PropTypes.object,
  customFrustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
  drivingLicenses: PropTypes.arrayOf(PropTypes.string.isRequired),
  email: PropTypes.string.isRequired,
  englishLevelEstimate: PropTypes.number,
  // TODO(pascal): Enforce one of FamilySituation from proto without bloating the client size.
  familySituation: PropTypes.string,
  frustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
  gender: PropTypes.string,
  hasHandicap: PropTypes.bool,
  highestDegree: PropTypes.string,
  lastName: PropTypes.string.isRequired,
  latestJob: PropTypes.object,
  name: PropTypes.string.isRequired,
  officeSkillsEstimate: PropTypes.number,
  // TODO(pascal): Enforce one of UserOrigin from proto without bloating the client size.
  origin: PropTypes.string,
  situation: PropTypes.string,
  yearOfBirth: PropTypes.number,
}
const USER_PROFILE_SHAPE = PropTypes.shape(USER_PROFILE_FIELDS)

function userAge(yearOfBirth) {
  const todayYear = (new Date()).getFullYear()
  return todayYear - yearOfBirth
}

// Returns a list of all frustrations of a user, as tags.
// TODO(guillaume): Pull directly from Airtable when we know for sure the shape.
function getUserFrustrationTags(profile) {
  const maybeE = profile.gender === 'FEMININE' ? 'e' : ''
  const frustrationsToTag = {
    AGE_DISCRIMINATION: 'Discriminations (âge)',
    ATYPIC_PROFILE: 'Profil atypique',
    EXPERIENCE: "L'expérience demandée",
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


const ORIGIN_OPTIONS = [
  {name: 'Recommandé par un ami', value: 'FROM_A_FRIEND'},
  {name: "Par un groupe de recherche d'emploi", value: 'FROM_JOBSEEKER_GROUP'},
  {name: 'Présenté dans une information collective Pôle emploi', value: 'FROM_PE_WORKSHOP'},
  {name: "Mon conseiller Pôle emploi me l'a recommandé", value: 'FROM_PE_COUNSELOR'},
  {name: 'Recommandé par un autre site ou moteur de recherche', value: 'FROM_WEBSITE'},
  {name: 'Autre', value: 'FROM_OTHER'},
]

export const personalizationsPredicates = {
  GRADUATE: ({highestDegree}) => highestDegree === 'LICENCE_MAITRISE' ||
    highestDegree === 'DEA_DESS_MASTER_PHD',
  NETWORK_SCORE_1: (profile, {networkEstimate}) => networkEstimate === 1,
  NETWORK_SCORE_2: (profile, {networkEstimate}) => networkEstimate === 2,
  NETWORK_SCORE_3: (profile, {networkEstimate}) => networkEstimate === 3,
  SAME_JOB: (profile, {previousJobSimilarity}) => previousJobSimilarity !== 'NEVER_DONE',
}

export const filterPredicatesMatch = {
  'for-experienced(2)': ({seniority}) => seniority === 'EXPERT' || seniority === 'SENIOR' ||
    seniority === 'INTERMEDIARY',
  'for-experienced(6)': ({seniority}) => seniority === 'EXPERT' || seniority === 'SENIOR',
}

function isEmailTemplatePersonalized(personalisations, profile, project) {
  // Check that personalization is not directly a frustration.
  const isFrustration = (profile.frustrations || []).find(frustration =>
    personalisations.find(personalisation => personalisation === frustration))
  if (isFrustration) {
    return true
  }

  return !!personalisations.map(p => personalizationsPredicates[p]).
    find(predicate => predicate && predicate(profile, project))
}

function projectMatchAllFilters(project, filters) {
  return !(filters || []).some(filter => !filterPredicatesMatch[filter](project))
}

// A function that returns a description for a degree.
// If no degree, we do not return any a description.
function getHighestDegreeDescription(userProfile) {
  if (userProfile.highestDegree === 'NO_DEGREE') {
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


function increaseRevision({revision, ...otherFields}) {
  return {
    revision: (revision || 0) + 1,
    ...otherFields,
  }
}


function keepMostRecentRevision(clientUser, serverUser) {
  const clientRevision = clientUser.revision || 0
  const serverRevision = serverUser.revision || 0
  if (!clientRevision || !serverRevision || clientRevision < serverRevision) {
    return serverUser
  }
  return clientUser
}


const youForUser = user => user.profile && user.profile.canTutoie ?
  tuSentence => tuSentence :
  (unusedTuSentence, vousSentence) => vousSentence


export {getUserFrustrationTags, USER_PROFILE_FIELDS, increaseRevision, youForUser,
  USER_PROFILE_SHAPE, userAge, getHighestDegreeDescription, keepMostRecentRevision,
  getFamilySituationOptions, DEGREE_OPTIONS, ORIGIN_OPTIONS, isEmailTemplatePersonalized,
  projectMatchAllFilters}

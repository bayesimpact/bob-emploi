import Storage from 'local-storage-fallback'
import {useSelector} from 'react-redux'

import {ClientFilter} from './french'
import {WithLocalizableName, prepareT} from './i18n'
import {PROJECT_EXPERIENCE_OPTIONS, PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_PASSIONATE_OPTIONS,
  SENIORITY_OPTIONS, TRAINING_FULFILLMENT_ESTIMATE_OPTIONS} from './project'


// TODO: Remove situation after the deprecated fields got removed from the
// user.proto.
const USER_PROFILE_FIELDS: readonly (keyof bayes.bob.UserProfile)[] = [
  'coachingEmailFrequency',
  'customFrustrations',
  'drivingLicenses',
  'email',
  'familySituation',
  'frustrations',
  'gender',
  'hasHandicap',
  'highestDegree',
  'lastName',
  'name',
  'origin',
  'yearOfBirth',
]

function userAge(yearOfBirth: number): number {
  const todayYear = (new Date()).getFullYear()
  return todayYear - yearOfBirth
}


// Returns a list of all frustrations of a user, as tags.
// TODO(guillaume): Pull directly from Airtable when we know for sure the shape.
function getUserFrustrationTags(profile: bayes.bob.UserProfile): readonly string[] {
  const maybeE = profile.gender === 'FEMININE' ? 'e' : ''
  const frustrationsToTag: {[f: string]: string} = {
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
  return (profile.frustrations || []).
    map((f: bayes.bob.Frustration): string|undefined => frustrationsToTag[f]).
    filter((t: string|undefined): t is string => !!t)
}


interface SelectOption<T = string> {
  readonly name: string
  readonly value: T
}


interface LocalizedSelectOption<T = string> extends WithLocalizableName {
  readonly value: T
}


const DEGREE_OPTIONS:
readonly (SelectOption<bayes.bob.DegreeLevel> & {readonly equivalent?: string})[] = [
  {name: '--', value: 'NO_DEGREE'},
  {name: 'CAP - BEP', value: 'CAP_BEP'},
  {name: 'Bac - Bac Pro', value: 'BAC_BACPRO'},
  {equivalent: 'Bac+2', name: 'BTS - DUT - DEUG', value: 'BTS_DUT_DEUG'},
  {equivalent: 'Bac+3', name: 'Licence - Maîtrise', value: 'LICENCE_MAITRISE'},
  {equivalent: 'Bac+5 et plus', name: 'DEA - DESS - Master - PhD', value: 'DEA_DESS_MASTER_PHD'},
]


const ORIGIN_OPTIONS: readonly LocalizedSelectOption<bayes.bob.UserOrigin>[] = [
  {name: prepareT('Recommandé par un ami'), value: 'FROM_A_FRIEND'},
  {name: prepareT("Par un groupe de recherche d'emploi"), value: 'FROM_JOBSEEKER_GROUP'},
  {
    name: prepareT('Présenté dans une information collective Pôle emploi'),
    value: 'FROM_PE_WORKSHOP',
  },
  {name: prepareT("Mon conseiller Pôle emploi me l'a recommandé"), value: 'FROM_PE_COUNSELOR'},
  {name: prepareT('Recommandé par un médiateur PIMMS'), value: 'FROM_PIMMS'},
  {name: prepareT('Recommandé par un autre site ou moteur de recherche'), value: 'FROM_WEBSITE'},
  {name: prepareT('Autre'), value: 'FROM_OTHER'},
]

const GENDER_OPTIONS: readonly LocalizedSelectOption<bayes.bob.Gender>[] = [
  {name: prepareT('une femme'), value: 'FEMININE'},
  {name: prepareT('un homme'), value: 'MASCULINE'},
] as const

export const personalizationsPredicates = {
  GRADUATE: ({highestDegree}: bayes.bob.UserProfile): boolean =>
    highestDegree === 'LICENCE_MAITRISE' || highestDegree === 'DEA_DESS_MASTER_PHD',
  NETWORK_SCORE_1: (profile: bayes.bob.UserProfile, {networkEstimate}: bayes.bob.Project):
  boolean => networkEstimate === 1,
  NETWORK_SCORE_2: (profile: bayes.bob.UserProfile, {networkEstimate}: bayes.bob.Project):
  boolean => networkEstimate === 2,
  NETWORK_SCORE_3: (profile: bayes.bob.UserProfile, {networkEstimate}: bayes.bob.Project):
  boolean => networkEstimate === 3,
  SAME_JOB: (profile: bayes.bob.UserProfile, {previousJobSimilarity}: bayes.bob.Project): boolean =>
    previousJobSimilarity !== 'NEVER_DONE',
} as const
type Personalization = keyof typeof personalizationsPredicates
type PersonalizationPredicate =
  (profile: bayes.bob.UserProfile, project: bayes.bob.Project) => boolean

type ProjectPredicate = (project: bayes.bob.Project) => boolean
export const filterPredicatesMatch: {[K in ClientFilter]: ProjectPredicate} = {
  'for-experienced(2)': ({seniority}: bayes.bob.Project): boolean => seniority === 'EXPERT' ||
    seniority === 'SENIOR' || seniority === 'INTERMEDIARY',
  'for-experienced(6)': ({seniority}: bayes.bob.Project): boolean =>
    seniority === 'EXPERT' || seniority === 'SENIOR',
}

function isEmailTemplatePersonalized(
  personalisations: readonly string[],
  profile: bayes.bob.UserProfile, project: bayes.bob.Project): boolean {
  // Check that personalization is not directly a frustration.
  const isFrustration = (profile.frustrations || []).find((frustration): boolean =>
    !!personalisations.find((personalisation): boolean => personalisation === frustration))
  if (isFrustration) {
    return true
  }

  return !!personalisations.
    map((p: string): PersonalizationPredicate|undefined =>
      personalizationsPredicates[p as Personalization]).
    find((predicate: PersonalizationPredicate|undefined): boolean =>
      !!predicate && predicate(profile, project))
}

function projectMatchAllFilters(project: bayes.bob.Project, filters?: readonly ClientFilter[]):
boolean {
  return !(filters || []).
    some((filter: ClientFilter): boolean => !filterPredicatesMatch[filter](project))
}

// A function that returns a description for a degree.
// If no degree, we do not return any a description.
function getHighestDegreeDescription(userProfile: bayes.bob.UserProfile): string|undefined {
  if (userProfile.highestDegree === 'NO_DEGREE') {
    // Exception where we do not want to show the option's name.
    return
  }
  const option = DEGREE_OPTIONS.find(({value}): boolean => value === userProfile.highestDegree)
  return option ? option.name : undefined
}


// 2635200000 = 1000 * 60 * 60 * 24 * 30.5
const MILLIS_IN_MONTH = 2635200000


// Returns user's job search length.
// TODO(sil): Update this when we stop using jobSearchLengthMonths.
function getJobSearchLengthMonths(project: bayes.bob.Project): number {
  const {jobSearchHasNotStarted = false,
    jobSearchLengthMonths = 0, jobSearchStartedAt = ''} = project
  return jobSearchHasNotStarted ? -1 : jobSearchStartedAt ?
    Math.round((Date.now() - new Date(jobSearchStartedAt).getTime()) / MILLIS_IN_MONTH) :
    jobSearchLengthMonths
}


const FAMILY_SITUATION_OPTIONS: readonly LocalizedSelectOption<bayes.bob.FamilySituation>[] = [
  {name: prepareT('Célibataire'), value: 'SINGLE'},
  {name: prepareT('En couple'), value: 'IN_A_RELATIONSHIP'},
  {name: prepareT('Famille avec enfants'), value: 'FAMILY_WITH_KIDS'},
  {name: prepareT('Parent seul'), value: 'SINGLE_PARENT_SITUATION'},
]


function increaseRevision({revision, ...otherFields}: bayes.bob.User): bayes.bob.User {
  return {
    revision: (revision || 0) + 1,
    ...otherFields,
  }
}


function keepMostRecentRevision(clientUser: bayes.bob.User, serverUser: bayes.bob.User):
bayes.bob.User {
  const clientRevision = clientUser.revision || 0
  const serverRevision = serverUser.revision || 0
  if (!clientRevision || !serverRevision || clientRevision < serverRevision) {
    return serverUser
  }
  return clientUser
}


function getUserLocale(profile?: bayes.bob.UserProfile): string {
  return profile?.locale || 'fr'
}


const COACHING_EMAILS_OPTIONS: LocalizedSelectOption<bayes.bob.EmailFrequency>[] = [
  {name: prepareT('Occasionnel (~1 email par mois)'), value: 'EMAIL_ONCE_A_MONTH'},
  {name: prepareT('Régulier (~1 email par semaine)'), value: 'EMAIL_MAXIMUM'},
  {name: prepareT("Pas d'email de coaching, merci"), value: 'EMAIL_NONE'},
]


function useGender(): bayes.bob.Gender|undefined {
  return useSelector(({user: {profile}}: {user: bayes.bob.User}) => profile?.gender)
}


function pickRandom<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)]
}


const sampleJobs: readonly bayes.bob.Job[] = [
  // Keep this one first or update the reference below (sampleJobs[0]).
  {
    codeOgr: '19364',
    feminineName: 'Secrétaire',
    jobGroup: {
      name: 'Secrétariat',
      romeId: 'M1607',
    },
    masculineName: 'Secrétaire',
    name: 'Secrétaire',
  },
  {
    codeOgr: '12688',
    feminineName: 'Coiffeuse',
    jobGroup: {
      name: 'Coiffure',
      romeId: 'D1202',
    },
    masculineName: 'Coiffeur',
    name: 'Coiffeur / Coiffeuse',
  },
  {
    codeOgr: '11573',
    feminineName: 'Boulangère',
    jobGroup: {
      name: 'Boulangerie - viennoiserie',
      romeId: 'D1102',
    },
    masculineName: 'Boulanger',
    name: 'Boulanger / Boulangère',
  },
  {
    codeOgr: '16067',
    feminineName: 'Jardinière',
    jobGroup: {
      name: 'Aménagement et entretien des espaces verts',
      romeId: 'A1203',
    },
    masculineName: 'Jardinier',
    name: 'Jardinier / Jardinière',
  },
] as const


const sampleCities: readonly bayes.bob.FrenchCity[] = [
  // Keep this one first or update the reference below (sampleCities[0]).
  {
    cityId: '80021',
    departementId: '80',
    departementName: 'Somme',
    departementPrefix: 'dans la ',
    name: 'Amiens',
    population: 133448,
    postcodes: '80000-80080-80090',
    publicTransportationScore: 5.26,
    regionId: '32',
    regionName: 'Hauts-de-France',
    urbanScore: 6,
  },
  {
    cityId: '32208',
    departementId: '32',
    departementName: 'Gers',
    departementPrefix: 'dans le ',
    name: 'Lectoure',
    population: 3785,
    postcodes: '32700',
    publicTransportationScore: 5.26,
    regionId: '76',
    regionName: 'Occitanie',
    urbanScore: 1,
  },
]


type PropsRequired<T, K extends keyof T> = T & Required<Pick<T, K>>


type PopulatedUser = bayes.bob.User & {
  profile: PropsRequired<bayes.bob.UserProfile,
  | 'coachingEmailFrequency'
  | 'familySituation'
  | 'gender'
  | 'hasCarDrivingLicense'
  | 'highestDegree'
  | 'origin'
  | 'yearOfBirth'>
  projects: [PropsRequired<bayes.bob.Project,
  | 'areaType'
  | 'city'
  | 'employmentTypes'
  | 'jobSearchStartedAt'
  | 'kind'
  | 'minSalary'
  | 'networkEstimate'
  | 'passionateLevel'
  | 'previousJobSimilarity'
  | 'seniority'
  | 'targetJob'
  | 'totalInterviewCount'
  | 'trainingFulfillmentEstimate'
  | 'weeklyApplicationsEstimate'
  | 'weeklyOffersEstimate'
  | 'workloads'>]
}


function getUserExample(isRandom: boolean): PopulatedUser {
  return {
    profile: {
      coachingEmailFrequency: pickRandom(COACHING_EMAILS_OPTIONS).value,
      familySituation: pickRandom(FAMILY_SITUATION_OPTIONS).value,
      // TODO(pascal): Add frustrations.
      gender: pickRandom(['FEMININE', 'MASCULINE']),
      hasCarDrivingLicense: pickRandom(['TRUE', 'FALSE']),
      highestDegree: isRandom ? pickRandom(DEGREE_OPTIONS).value : 'BAC_BACPRO',
      origin: pickRandom(ORIGIN_OPTIONS).value,
      yearOfBirth: isRandom ? Math.round(1950 + 50 * Math.random()) : 1995,
    },
    projects: [{
      areaType: isRandom ? pickRandom(PROJECT_LOCATION_AREA_TYPE_OPTIONS).value : 'COUNTRY',
      city: isRandom ? pickRandom(sampleCities) : sampleCities[0],
      employmentTypes: ['CDI'],
      jobSearchStartedAt: new Date(new Date().getTime() - MILLIS_IN_MONTH * 6).toISOString(),
      kind: 'FIND_A_NEW_JOB',
      minSalary: 21500,
      networkEstimate: Math.floor(Math.random() * 3) + 1,
      passionateLevel: isRandom ? pickRandom(PROJECT_PASSIONATE_OPTIONS).value : 'PASSIONATING_JOB',
      previousJobSimilarity: pickRandom(PROJECT_EXPERIENCE_OPTIONS).value,
      seniority: pickRandom(SENIORITY_OPTIONS).value,
      targetJob: isRandom ? pickRandom(sampleJobs) : sampleJobs[0],
      totalInterviewCount: isRandom ? (Math.floor(Math.random() * 22) || -1) : -1,
      trainingFulfillmentEstimate: pickRandom(TRAINING_FULFILLMENT_ESTIMATE_OPTIONS).value,
      weeklyApplicationsEstimate: 'SOME',
      weeklyOffersEstimate: 'DECENT_AMOUNT',
      workloads: ['FULL_TIME'],
    }],
  }
}

// To setup a random fast forward (mostly for devs), open a console in your browser and run:
//    localStorage.setItem('randomFastForward', '1')
// then refresh the page.
const isRandomFastForward = !!Storage.getItem('randomFastForward')
if (isRandomFastForward) {
  // eslint-disable-next-line no-console
  console.log(
    'Random Fast-Forward is activated. ' +
    'To disable run: localStorage.removeItem("randomFastForward") and refresh.')
}
const userExample = getUserExample(isRandomFastForward)


function getUniqueExampleEmail(): string {
  return 'test-' + (new Date().getTime()) + '@example.com'
}


function isAdvisorUser(user: bayes.bob.User): boolean {
  const {advisor = undefined, switchedFromMashupToAdvisor = false} = user.featuresEnabled || {}
  return (!advisor || advisor === 'ACTIVE') &&
    (user.projects || []).length <= 1 ||
    switchedFromMashupToAdvisor
}


function addProjectIds(user: bayes.bob.User): bayes.bob.User {
  if (!user.projects || !user.projects.some(({projectId}): boolean => !projectId)) {
    return user
  }
  return {
    ...user,
    projects: user.projects.map((project, index): bayes.bob.Project => ({
      ...project,
      projectId: index + '',
    })),
  }
}


export {
  getUserFrustrationTags, USER_PROFILE_FIELDS, increaseRevision,
  userAge, getHighestDegreeDescription, keepMostRecentRevision,
  FAMILY_SITUATION_OPTIONS, DEGREE_OPTIONS, ORIGIN_OPTIONS, isEmailTemplatePersonalized,
  projectMatchAllFilters, COACHING_EMAILS_OPTIONS, GENDER_OPTIONS, userExample,
  getUniqueExampleEmail, getJobSearchLengthMonths, getUserLocale, isAdvisorUser,
  useGender, addProjectIds,
}

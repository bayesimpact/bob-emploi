import {TFunction} from 'i18next'
import Storage from 'local-storage-fallback'
import {useMemo} from 'react'
import {useSelector} from 'react-redux'
import {useTranslation} from 'react-i18next'

import {RootState} from 'store/actions'
import {convertFromProtoPost} from 'store/api'
import {parseQueryString} from 'store/parse'

import {DEGREE_OPTIONS} from 'deployment/profile_options'
import {sampleCities, sampleJobs} from 'deployment/user_examples'

import {LocalizableString, WithLocalizableName, prepareT} from './i18n'
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
function getUserFrustrationTags(profile: bayes.bob.UserProfile, t: TFunction): readonly string[] {
  const frustrationsToTag: {[f: string]: string} = {
    AGE_DISCRIMINATION: t('Discriminations (âge)'),
    ATYPIC_PROFILE: t('Profil atypique'),
    EXPERIENCE: t("L'expérience demandée"),
    HANDICAPED: t('Handicap non adapté'),
    INTERVIEW: t("Entretiens d'embauche"),
    MOTIVATION: t('Rester motivé·e', {context: profile.gender}),
    NO_OFFERS: t("Pas assez d'offres"),
    NO_OFFER_ANSWERS: t('Pas assez de réponses'),
    RACE_DISCRIMINATION: t('Discriminations (ethnicité)'),
    RESUME: t('Rédaction CVs et lettres de motivation'),
    SEX_DISCRIMINATION: t('Discriminations (H/F)'),
    SINGLE_PARENT: t('Situation familiale compliquée'),
    TIME_MANAGEMENT: t('Gestion de mon temps'),
    TRAINING: t('Formations professionnelles'),
  }
  return (profile.frustrations || []).
    map((f: bayes.bob.Frustration): string|undefined => frustrationsToTag[f]).
    filter((t: string|undefined): t is string => !!t)
}


interface LocalizedSelectOption<T = string> extends WithLocalizableName {
  readonly value: T
}


interface FrustrationOption extends LocalizedSelectOption<bayes.bob.Frustration> {
  filter?: (profile: bayes.bob.UserProfile) => boolean
  isCountryDependent?: true
}


const ORIGIN_OPTIONS: readonly LocalizedSelectOption<bayes.bob.UserOrigin>[] = ([
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
] as const).filter(({value}) => !config.originOptionsExcluded.includes(value))

const GENDER_OPTIONS: readonly LocalizedSelectOption<bayes.bob.Gender>[] = [
  {name: prepareT('une femme'), value: 'FEMININE'},
  {name: prepareT('un homme'), value: 'MASCULINE'},
] as const


const parentSituation: Set<bayes.bob.FamilySituation> =
  new Set(['SINGLE_PARENT_SITUATION', 'FAMILY_WITH_KIDS'])
const isPotentialLongTermMom = ({familySituation, gender}: bayes.bob.UserProfile): boolean =>
  gender === 'FEMININE' && !!familySituation && parentSituation.has(familySituation)

const FRUSTRATION_OPTIONS: readonly FrustrationOption[] = ([
  {
    name: prepareT("Le **manque d'offres**, correspondant à mes critères"),
    value: 'NO_OFFERS',
  },
  {
    name: prepareT('Le **manque de réponses** des recruteurs, même négatives'),
    value: 'NO_OFFER_ANSWERS',
  },
  {
    name: prepareT(
      'La rédaction des **CVs** et **lettres de motivation**',
    ),
    value: 'RESUME',
  },
  {
    name: prepareT("Les **entretiens** d'embauche"),
    value: 'INTERVIEW',
  },
  {
    name: prepareT('Le système des **formations** professionnelles'),
    value: 'TRAINING',
  },
  {
    name: prepareT('La difficulté de **rester motivé·e** dans ma recherche'),
    value: 'MOTIVATION',
  },
  {
    name: prepareT('Le manque de **confiance en moi**'),
    value: 'SELF_CONFIDENCE',
  },
  {
    name: prepareT('La gestion de mon temps pour être **efficace**'),
    value: 'TIME_MANAGEMENT',
  },
  {
    name: prepareT("L'**expérience demandée** pour le poste"),
    value: 'EXPERIENCE',
  },
  {
    isCountryDependent: true,
    // i18next-extract-mark-context-next-line ["fr", "uk", "us"]
    name: prepareT('Mon niveau en **français**'),
    value: 'LANGUAGE',
  },
  {
    isCountryDependent: true,
    // i18next-extract-mark-context-next-line ["fr", "uk", "us"]
    name: prepareT('Mes qualifications ne sont **pas reconnues en France**'),
    value: 'FOREIGN_QUALIFICATIONS',
  },
  {
    name: prepareT('**Ne pas rentrer dans les cases** des recruteurs'),
    value: 'ATYPIC_PROFILE',
  },
  {
    name: prepareT('Des discriminations liées à mon **âge**'),
    value: 'AGE_DISCRIMINATION',
  },
  {
    // TODO(pascal): Reassess when we show this.
    filter: ({gender}: bayes.bob.UserProfile): boolean => gender === 'FEMININE',
    name: prepareT('Des discriminations liées à mon **sexe**'),
    value: 'SEX_DISCRIMINATION',
  },
  {
    name: prepareT('Des discriminations liées à mon **origine ethnique**'),
    value: 'RACE_DISCRIMINATION',
  },
  {
    // TODO(pascal): Reassess when we show this.
    filter: isPotentialLongTermMom,
    name: prepareT("L'interruption de ma carrière pour **élever mes enfants**"),
    value: 'STAY_AT_HOME_PARENT',
  },
  {
    filter: ({familySituation}: bayes.bob.UserProfile) =>
      !!familySituation && parentSituation.has(familySituation),
    name: prepareT("L'accès à un **mode de garde** pour mon ou mes enfants"),
    value: 'CHILD_CARE',
  },
] as const).filter(({value}) => !config.frustrationOptionsExcluded.includes(value))


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
export const filterPredicatesMatch: {[K in download.ClientFilter]: ProjectPredicate} = {
  'for-experienced(2)': ({seniority}: bayes.bob.Project): boolean => seniority === 'EXPERT' ||
    seniority === 'SENIOR' || seniority === 'INTERMEDIARY',
  'for-experienced(6)': ({seniority}: bayes.bob.Project): boolean =>
    seniority === 'EXPERT' || seniority === 'SENIOR',
}

function isEmailTemplatePersonalized(
  personalisations: readonly string[],
  profile: bayes.bob.UserProfile, project: bayes.bob.Project): boolean {
  // Check that personalization is not directly a frustration.
  const isFrustration = profile.frustrations?.some(
    (frustration): boolean => personalisations.includes(frustration))
  if (isFrustration) {
    return true
  }

  return personalisations.
    map((p: string): PersonalizationPredicate|undefined =>
      personalizationsPredicates[p as Personalization]).
    some(predicate => predicate?.(profile, project))
}

function projectMatchAllFilters(
  project: bayes.bob.Project, filters?: readonly download.ClientFilter[],
): boolean {
  return !(filters || []).
    some((filter: download.ClientFilter): boolean => !filterPredicatesMatch[filter](project))
}

// A function that returns a description for a degree.
// If no degree, we do not return any a description.
function getHighestDegreeDescription(userProfile: bayes.bob.UserProfile):
LocalizableString|undefined {
  if (userProfile.highestDegree === 'NO_DEGREE') {
    // Exception where we do not want to show the option's name.
    return
  }
  const option = DEGREE_OPTIONS.find(({value}): boolean => value === userProfile.highestDegree)
  return option ? option.name : undefined
}


// 2,635,200,000 = 1000 * 60 * 60 * 24 * 30.5
const MILLIS_IN_MONTH = 2_635_200_000


// Returns user's job search length.
// -1 means: not started yet
// 0 means: unknown
// positive number means the number of month
function getJobSearchLengthMonths(project: bayes.bob.Project): number {
  const {jobSearchHasNotStarted = false, jobSearchStartedAt = '', createdAt = Date.now()} = project
  if (jobSearchHasNotStarted) {
    return -1
  }
  if (!jobSearchStartedAt) {
    return 0
  }
  const createdAtTime = createdAt ? new Date(createdAt).getTime() : Date.now()
  const duration = createdAtTime - new Date(jobSearchStartedAt).getTime()
  return Math.round(duration / MILLIS_IN_MONTH)
}


const FAMILY_SITUATION_OPTIONS: readonly LocalizedSelectOption<bayes.bob.FamilySituation>[] = [
  {name: prepareT('Célibataire sans enfant'), value: 'SINGLE'},
  {name: prepareT('En couple sans enfant'), value: 'IN_A_RELATIONSHIP'},
  {name: prepareT('Parent en couple'), value: 'FAMILY_WITH_KIDS'},
  {name: prepareT('Parent célibataire'), value: 'SINGLE_PARENT_SITUATION'},
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
  return profile?.locale || config.defaultLang
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
  return options[Math.floor(Math.random() * options.length)] as T
}


function translateJob(translate: TFunction, job: typeof sampleJobs[number]): bayes.bob.Job {
  const {
    feminineName,
    jobGroup: {
      name: jobGroupName,
      ...otherJobGroupProps
    } = {},
    masculineName,
    name,
    ...otherProps
  } = job
  return {
    ...otherProps,
    feminineName: feminineName && translate(...feminineName),
    jobGroup: {
      ...otherJobGroupProps,
      name: jobGroupName && translate(...jobGroupName),
    },
    masculineName: masculineName && translate(...masculineName),
    name: name && translate(...name),
  }
}


const getUserFormUrl = ((): (() => bayes.bob.User) => {
  let userFromURL: bayes.bob.User = {}
  async function fetchUserFromUrl(search: string): Promise<void> {
    if (!search) {
      return
    }
    const {userExample: user = undefined} = parseQueryString(search)
    if (!user) {
      return
    }
    if (user.startsWith('{')) {
      try {
        userFromURL = JSON.parse(user) as bayes.bob.User
      } catch {
        return
      }
    }
    const userParsed = await convertFromProtoPost('user', user)
    if (userParsed) {
      userFromURL = userParsed
    }
  }
  fetchUserFromUrl(window.location.search)
  return () => userFromURL
})()


type PropsRequired<T, K extends keyof T> = T & Required<Pick<T, K>>


type PopulatedUser = bayes.bob.User & {
  profile: PropsRequired<bayes.bob.UserProfile,
  | 'coachingEmailFrequency'
  | 'familySituation'
  | 'frustrations'
  | 'gender'
  | 'hasCarDrivingLicense'
  | 'highestDegree'
  | 'name'
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


function getUserExample(isRandom: boolean, translate: TFunction): PopulatedUser {
  const t = translate
  const userFromURL = getUserFormUrl()
  return {
    profile: {
      coachingEmailFrequency: pickRandom(COACHING_EMAILS_OPTIONS).value,
      familySituation: pickRandom(FAMILY_SITUATION_OPTIONS).value,
      frustrations: FRUSTRATION_OPTIONS.map(({value}) => value).filter(() => Math.random() > .5),
      gender: isRandom ? pickRandom(['FEMININE', 'MASCULINE']) : 'FEMININE',
      hasCarDrivingLicense: pickRandom(['TRUE', 'FALSE']),
      highestDegree: isRandom ? pickRandom(DEGREE_OPTIONS).value : 'BAC_BACPRO',
      name: t('Angèle'),
      origin: pickRandom(ORIGIN_OPTIONS).value,
      yearOfBirth: isRandom ? Math.round(1950 + 50 * Math.random()) : 1995,
      ...userFromURL.profile,
    },
    projects: [{
      areaType: isRandom ? pickRandom(PROJECT_LOCATION_AREA_TYPE_OPTIONS).value : 'COUNTRY',
      city: isRandom ? pickRandom(sampleCities) : sampleCities[0],
      employmentTypes: ['CDI'],
      jobSearchStartedAt: new Date(Date.now() - MILLIS_IN_MONTH * 6).toISOString(),
      kind: 'FIND_A_NEW_JOB',
      minSalary: 21_500,
      networkEstimate: Math.floor(Math.random() * 3) + 1,
      passionateLevel: isRandom ? pickRandom(PROJECT_PASSIONATE_OPTIONS).value : 'PASSIONATING_JOB',
      previousJobSimilarity: pickRandom(PROJECT_EXPERIENCE_OPTIONS).value,
      seniority: pickRandom(SENIORITY_OPTIONS).value,
      targetJob: translateJob(translate, isRandom ? pickRandom(sampleJobs) : sampleJobs[0]),
      totalInterviewCount: isRandom ? (Math.floor(Math.random() * 22) || -1) : -1,
      trainingFulfillmentEstimate: pickRandom(TRAINING_FULFILLMENT_ESTIMATE_OPTIONS).value,
      weeklyApplicationsEstimate: 'SOME',
      weeklyOffersEstimate: 'DECENT_AMOUNT',
      workloads: ['FULL_TIME'],
      ...userFromURL.projects?.[0],
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


function useUserExample(): PopulatedUser {
  const {t} = useTranslation()
  return useMemo((): PopulatedUser => {
    return getUserExample(isRandomFastForward, t)
  }, [t])
}


function getUniqueExampleEmail(): string {
  return 'test-' + (Date.now()) + '@example.com'
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


// To setup the convince page demo:
//    localStorage.setItem('convincePageDev', '1')
// then refresh the page.
const isConvincePageDevActivated = !!Storage.getItem('convincePageDev')
if (isConvincePageDevActivated) {
  // eslint-disable-next-line no-console
  console.log(
    'Convince Page Dev is activated. ' +
    'To disable run: localStorage.removeItem("convincePageDev") and refresh.')
}


// Main feature flag for the Convince Page sprint.
// TODO(émilie): Delete useAlwaysConvincePage when launched.
function useAlwaysConvincePage(): boolean {
  return true
}

// To setup the selfDiagnostic in intro demo:
//    localStorage.setItem('selfDiagIntroDev', '1')
// then refresh the page.
const isSelfDiagnosticInIntro = !!Storage.getItem('selfDiagIntroDev')
if (isSelfDiagnosticInIntro) {
  // eslint-disable-next-line no-console
  console.log(
    'Self diagnostic in intro Dev is activated. ' +
    'To disable run: localStorage.removeItem("selfDiagIntroDev") and refresh.')
}

// Main feature flag for self diagnostic moved into the intro.
// TODO(émilie): Delete when released.
function useSelfDiagnosticInIntro(): boolean {
  const lateSelfDiagnostic = useSelector(
    ({user: {featuresEnabled}}: {user: bayes.bob.User}) => featuresEnabled?.lateSelfDiagnostic)
  return lateSelfDiagnostic !== 'ACTIVE'
}

const useEmailsInProfile = (): boolean =>
  useSelector(({user: {featuresEnabled: {alpha} = {}}}: RootState) => !!alpha)

export {
  getUserFrustrationTags, USER_PROFILE_FIELDS, increaseRevision,
  userAge, getHighestDegreeDescription, keepMostRecentRevision, useEmailsInProfile,
  FAMILY_SITUATION_OPTIONS, DEGREE_OPTIONS, ORIGIN_OPTIONS, isEmailTemplatePersonalized,
  projectMatchAllFilters, COACHING_EMAILS_OPTIONS, GENDER_OPTIONS, useUserExample,
  getUniqueExampleEmail, getJobSearchLengthMonths, getUserLocale, isAdvisorUser,
  useGender, addProjectIds, FRUSTRATION_OPTIONS, useAlwaysConvincePage, useSelfDiagnosticInIntro,
}

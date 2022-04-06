import * as Sentry from '@sentry/browser'
import type {TFunction, TOptions} from 'i18next'
import i18next from 'i18next'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import {useParams} from 'react-router-dom'
import {useSelector} from 'react-redux'

import type {RootState} from 'store/actions'
import diagnosticIllustrations from 'store/data/diagnosticIllustrations.json'
import impactMeasurement from 'store/data/impactMeasurement.json'
import type {LocalizableString, WithLocalizableName} from 'store/i18n'
import {getFieldsTranslator, prepareT as blankPrepareT, combineTOptions} from 'store/i18n'
import {genderizeJob} from 'store/job'
import {inCityPrefix} from 'store/french'


const emptyArray = [] as const


const prepareT = (value: string, options?: TOptions|string) =>
  combineTOptions(blankPrepareT(value, options), {namespace: 'translation'})

const NO_CHALLENGE_CATEGORY_ID = 'bravo'

interface LocalizedSelectOption<T = string> extends WithLocalizableName {
  readonly value: T
  readonly disabled?: true
}

const PROJECT_EXPERIENCE_OPTIONS: LocalizedSelectOption<bayes.bob.PreviousJobSimilarity>[] = [
  {name: prepareT("Oui, j'ai déjà fait ce métier"), value: 'DONE_THIS'},
  {name: prepareT("J'ai déjà fait un métier similaire"), value: 'DONE_SIMILAR'},
  {name: prepareT("C'est un nouveau métier pour moi"), value: 'NEVER_DONE'},
]

const PROJECT_LOCATION_AREA_TYPE_OPTIONS: LocalizedSelectOption<bayes.bob.AreaType>[] = [
  {name: prepareT('Uniquement dans cette ville'), value: 'CITY'},
  // i18next-extract-mark-context-start ["", "fr", "uk", "usa"]
  {name: prepareT('Dans le département'), value: 'DEPARTEMENT'},
  {name: prepareT('Dans toute la région'), value: 'REGION'},
  {name: prepareT('Dans toute la France'), value: 'COUNTRY'},
  // i18next-extract-mark-context-stop
]

const PROJECT_EMPLOYMENT_TYPE_OPTIONS: LocalizedSelectOption<bayes.bob.EmploymentType>[] = ([
  {name: prepareT('temps plein'), value: 'FULL_TIME_EMPLOYMENT'},
  {name: prepareT('temps partiel'), value: 'PART_TIME_EMPLOYMENT'},
  {name: prepareT('CDI'), value: 'CDI'},
  {name: prepareT('CDD long (+ de 3 mois)'), value: 'CDD_OVER_3_MONTHS'},
  {name: prepareT('CDD court (- de 3 mois)'), value: 'CDD_LESS_EQUAL_3_MONTHS'},
  {name: prepareT('interim'), value: 'INTERIM'},
  {name: prepareT('alternance'), value: 'ALTERNANCE'},
  {name: prepareT('stage'), value: 'INTERNSHIP'},
] as const).filter(({value}) => !config.projectEmploymentTypeOptionsExcluded.includes(value))

const PROJECT_KIND_OPTIONS: LocalizedSelectOption<bayes.bob.ProjectKind>[] = [
  {name: prepareT('Retrouver un emploi'), value: 'FIND_A_NEW_JOB'},
  {name: prepareT('Me reconvertir'), value: 'REORIENTATION'},
  {name: prepareT('Trouver mon premier emploi'), value: 'FIND_A_FIRST_JOB'},
  {name: prepareT('Trouver un autre emploi (je suis en poste)'), value: 'FIND_ANOTHER_JOB'},
  {
    name: prepareT('Développer ou reprendre une activité'),
    value: 'CREATE_OR_TAKE_OVER_COMPANY',
  },
]


const PROJECT_WORKLOAD_OPTIONS: LocalizedSelectOption<bayes.bob.ProjectWorkload>[] = [
  {name: prepareT('à temps plein'), value: 'FULL_TIME'},
  {name: prepareT('à temps partiel'), value: 'PART_TIME'},
]


type RealUnit = Exclude<bayes.bob.SalaryUnit, 'UNKNOWN_SALARY_UNIT'>
// Keep in sync with frontend/server/scoring_base.py
const SALARY_TO_GROSS_ANNUAL_FACTORS: Record<RealUnit, number> = {
  ANNUAL_GROSS_SALARY: 1,
  HOURLY_GROSS_SALARY: 52 * config.hoursPerWeek,
  HOURLY_NET_SALARY: 52 * config.hoursPerWeek / config.grossToNet,
  MONTHLY_GROSS_SALARY: 12,
  MONTHLY_NET_SALARY: 12 / config.grossToNet,
} as const


const convertToUnit = (salary: bayes.bob.SalaryEstimation, unit: RealUnit):
bayes.bob.SalaryEstimation => {
  const {maxSalary = 0, medianSalary = 0, minSalary = 0, unit: previousUnit} = salary
  if (!previousUnit || previousUnit === 'UNKNOWN_SALARY_UNIT' || previousUnit === unit) {
    // Unable/Useless to transfer to a new unit.
    return salary
  }
  const [newMin, newMed, newMax] = [minSalary, medianSalary, maxSalary].map(s =>
    s * SALARY_TO_GROSS_ANNUAL_FACTORS[previousUnit] / SALARY_TO_GROSS_ANNUAL_FACTORS[unit])
  return {
    maxSalary: newMax,
    medianSalary: newMed,
    minSalary: newMin,
    unit,
  }
}

const SALARY_UNIT_OPTIONS: readonly LocalizedSelectOption<RealUnit>[] = ([
  {name: prepareT('brut par an'), value: 'ANNUAL_GROSS_SALARY'},
  {name: prepareT('net par mois'), value: 'MONTHLY_NET_SALARY'},
  {name: prepareT('brut par mois'), value: 'MONTHLY_GROSS_SALARY'},
  {name: prepareT('net par heure'), value: 'HOURLY_NET_SALARY'},
  {name: prepareT('brut par heure'), value: 'HOURLY_GROSS_SALARY'},
] as const).filter(({value}) =>
  value === 'ANNUAL_GROSS_SALARY' || !config.salaryUnitOptionsExcluded.includes(value))
const VALID_SALARY_UNITS = new Set(SALARY_UNIT_OPTIONS.map(({value}) => value))

const SALARY_UNIT_FALLBACKS: {[key in bayes.bob.SalaryUnit]?: readonly bayes.bob.SalaryUnit[]} = {
  HOURLY_GROSS_SALARY: ['HOURLY_NET_SALARY'],
  HOURLY_NET_SALARY: ['HOURLY_GROSS_SALARY'],
  MONTHLY_GROSS_SALARY: ['MONTHLY_NET_SALARY'],
  MONTHLY_NET_SALARY: ['MONTHLY_GROSS_SALARY'],
} as const

// From a salary unit, get the best valid options for this deployment (some options are excluded
// by config.salaryUnitOptionsExcluded).
const getBestValidSalaryUnit = (
  preferredSalaryUnit: bayes.bob.SalaryUnit = 'ANNUAL_GROSS_SALARY'): RealUnit => {
  const validUnit = preferredSalaryUnit as RealUnit
  if (VALID_SALARY_UNITS.has(validUnit)) {
    return validUnit
  }
  const fallbackUnit = (SALARY_UNIT_FALLBACKS[preferredSalaryUnit] || []).find(
    (fallbackUnit: bayes.bob.SalaryUnit): fallbackUnit is RealUnit =>
      VALID_SALARY_UNITS.has(fallbackUnit as RealUnit))
  return fallbackUnit || 'ANNUAL_GROSS_SALARY'
}

const getSalaryText = (unit: RealUnit, translate: TFunction): string => {
  const {name} = SALARY_UNIT_OPTIONS.find(({value}) => value === unit) || {}
  if (!name) {
    return ''
  }
  return translate(...name)
}

const SENIORITY: {
  [seniority in bayes.bob.ProjectSeniority]: {
    long: LocalizableString
    short: LocalizableString
  }
} = {
  CARREER: {
    long: prepareT("avec plus de 20 ans d'expérience"),
    short: prepareT('Plus de 20 ans'),
  },
  EXPERT: {
    long: prepareT("avec plus de 10 ans d'expérience"),
    short: prepareT('Plus de 10 ans'),
  },
  INTERMEDIARY: {
    long: prepareT("avec entre 2 et 5 ans d'expérience"),
    short: prepareT('2 à 5 ans'),
  },
  INTERN: {
    long: prepareT('avec une expérience de stage'),
    short: prepareT('Stage'),
  },
  JUNIOR: {
    long: prepareT("avec moins de deux ans d'expérience"),
    short: prepareT('Moins de 2 ans'),
  },
  NO_SENIORITY: {
    long: prepareT('sans expérience'),
    short: prepareT("pas d'expérience"),
  },
  SENIOR: {
    long: prepareT("avec entre 5 et 10 ans d'expérience"),
    short: prepareT('6 à 10 ans'),
  },
  UNKNOWN_PROJECT_SENIORITY: {
    long: prepareT('sans expérience'),
    short: prepareT("pas d'expérience"),
  },
} as const


const SENIORITY_OPTIONS = (['INTERN', 'JUNIOR', 'INTERMEDIARY', 'SENIOR', 'EXPERT'] as const).
  map((value): LocalizedSelectOption<bayes.bob.ProjectSeniority> =>
    ({name: SENIORITY[value].short, value}))


const PROJECT_PASSIONATE_OPTIONS: LocalizedSelectOption<bayes.bob.PassionateLevel>[] = [
  {name: prepareT('Le métier de ma vie'), value: 'LIFE_GOAL_JOB'},
  {name: prepareT('Un métier passionnant'), value: 'PASSIONATING_JOB'},
  {name: prepareT('Un métier intéressant'), value: 'LIKEABLE_JOB'},
  {name: prepareT('Un métier comme un autre'), value: 'ALIMENTARY_JOB'},
]


const getSeniorityText = (translate: TFunction, seniority?: bayes.bob.ProjectSeniority): string => {
  const {short = undefined} = seniority && SENIORITY[seniority] || {}
  return short ? translate(...short) : ''
}

interface TitleComponents {
  experience?: string
  what?: string
  where?: string
}

const createProjectTitleComponents =
  (project: bayes.bob.Project, t: TFunction, gender?: bayes.bob.Gender):
  TitleComponents => {
    const {cityName, prefix} = inCityPrefix(project.city && project.city.name || '', t)
    const where = prefix + cityName
    if (project.targetJob) {
      const {long = undefined} = project.seniority && SENIORITY[project.seniority] || {}
      return {
        // i18next-extract-disable-next-line
        experience: long ? t(...long) : '',
        what: genderizeJob(project.targetJob, gender),
        where,
      }
    }
    if (project.kind === 'CREATE_COMPANY') {
      return {
        what: t('Créer une entreprise'),
        where,
      }
    }
    if (project.kind === 'TAKE_OVER_COMPANY') {
      return {
        what: t('Reprendre une entreprise'),
        where,
      }
    }
    if (project.kind === 'REORIENTATION') {
      return {
        what: t('Me réorienter'),
        where,
      }
    }
    return {
      what: t('Trouver un emploi'),
      where,
    }
  }


const createProjectTitle =
  (newProject: bayes.bob.Project, t: TFunction, gender?: bayes.bob.Gender): string|undefined => {
    const {what, where} = createProjectTitleComponents(newProject, t, gender)
    if (what && where) {
      return `${what} ${where}`
    }
  }


const newProject =
  (newProjectData: bayes.bob.Project, t: TFunction, gender?: bayes.bob.Gender):
  bayes.bob.Project => {
    const {
      projectId: omittedProjectId,
      createdAt: omittedCreatedAt,
      isIncomplete: omittedIsIncomplete,
      ...cleanedProject} = newProjectData
    return {
      ...cleanedProject,
      status: 'PROJECT_CURRENT',
      title: createProjectTitle(newProjectData, t, gender),
    }
  }


const TRAINING_FULFILLMENT_ESTIMATE_OPTIONS:
readonly LocalizedSelectOption<bayes.bob.TrainingFulfillmentEstimate>[] = [
  {
    name: prepareT("Oui, j'ai les diplômes suffisants"),
    value: 'ENOUGH_DIPLOMAS',
  },
  {
    name: prepareT("Je ne pense pas, mais j'ai beaucoup d'expérience"),
    value: 'ENOUGH_EXPERIENCE',
  },
  {
    name: prepareT('Bientôt, je fais une formation pour ce poste'),
    value: 'CURRENTLY_IN_TRAINING',
  },
  {
    name: prepareT('Je ne suis pas sûr·e'),
    value: 'TRAINING_FULFILLMENT_NOT_SURE',
  },
]

// TODO(émilie): Consider merging with newProject function.
const flattenProject = (projectFields: bayes.bob.Project): bayes.bob.Project => ({
  city: undefined,
  employmentTypes: ['CDI', 'FULL_TIME_EMPLOYMENT'],
  kind: undefined,
  minSalary: undefined,
  passionateLevel: undefined,
  previousJobSimilarity: undefined,
  targetJob: undefined,
  workloads: ['FULL_TIME'],
  ...projectFields,
  createdAt: '',
  isIncomplete: true,
  projectId: '',
})


const CHALLENGE_RELEVANCE_COLORS: {[R in bayes.bob.MainChallengeRelevance]?: string} = {
  NEEDS_ATTENTION: colors.RED_PINK,
  NEUTRAL_RELEVANCE: colors.MODAL_PROJECT_GREY,
  NOT_RELEVANT: 'rgba(0, 0, 0, 0)',
  RELEVANT_AND_GOOD: colors.GREENISH_TEAL,
}


type DiagnosticIllustrationsMap = {
  readonly [categoryId: string]: readonly download.Illustration[]
}


const translatedDiagnosticIllustrationsMap = _memoize(
  (translate: TFunction): DiagnosticIllustrationsMap => {
    const translator = getFieldsTranslator<'highlight'|'text', download.Illustration>(
      translate, ['highlight', 'text'], 'diagnosticIllustrations')
    return _mapValues(diagnosticIllustrations, illustrations => illustrations.map(translator))
  },
  (): string => i18next.language,
)


const getDiagnosticIllustrations =
  (categoryId: string | undefined, translate: TFunction): readonly download.Illustration[] => {
    if (!categoryId) {
      return emptyArray
    }
    const illustrationsMap = translatedDiagnosticIllustrationsMap(translate)
    const illustrations = illustrationsMap[categoryId] || emptyArray
    if (!illustrations.length) {
      Sentry.captureMessage(`No illustrations defined for the main challenge "${categoryId}"`)
    }
    return illustrations
  }

const getTranslatedImpactMeasurement = _memoize(
  (translate: TFunction): readonly download.ImpactMeasurement[] => {
    const translator = getFieldsTranslator<'name', download.ImpactMeasurement>(
      translate, ['name'], 'impactMeasurement')
    return impactMeasurement.map(translator)
  },
  (): string => i18next.language,
)

function getProject(pId: string, projects: bayes.bob.User['projects'] = []): bayes.bob.Project {
  const project = projects.find(({projectId}: bayes.bob.Project): boolean => projectId === pId)
  if (project) {
    return project
  }
  if (projects.length) {
    return projects[0]
  }
  return {}
}

const hasProjectId = (project: bayes.bob.Project):
project is bayes.bob.Project & {projectId: string} => !!project.projectId

// TODO(cyrille): Use everywhere relevant.
function useProject(isProjectIdRequired: true):
undefined|(bayes.bob.Project & {projectId: string})
function useProject(isProjectIdRequired?: false): undefined|bayes.bob.Project
function useProject(isProjectIdRequired?: boolean): undefined|bayes.bob.Project {
  const {projectId = ''} = useParams<{projectId?: string}>()
  const projects = useSelector(({user: {projects = []}}: RootState) => projects)
  const project = getProject(projectId, projects)
  if (!project || !hasProjectId(project) && isProjectIdRequired) {
    return
  }
  return project
}

export {
  PROJECT_EXPERIENCE_OPTIONS, PROJECT_PASSIONATE_OPTIONS, useProject,
  PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_EMPLOYMENT_TYPE_OPTIONS,
  PROJECT_WORKLOAD_OPTIONS, PROJECT_KIND_OPTIONS, createProjectTitle, newProject,
  createProjectTitleComponents, getSeniorityText, SALARY_TO_GROSS_ANNUAL_FACTORS,
  TRAINING_FULFILLMENT_ESTIMATE_OPTIONS, flattenProject, SENIORITY_OPTIONS,
  NO_CHALLENGE_CATEGORY_ID, CHALLENGE_RELEVANCE_COLORS, getDiagnosticIllustrations,
  getTranslatedImpactMeasurement, convertToUnit, SALARY_UNIT_OPTIONS, getSalaryText,
  getBestValidSalaryUnit,
}

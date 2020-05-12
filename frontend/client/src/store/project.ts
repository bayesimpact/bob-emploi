import {TFunction} from 'i18next'

import {WithLocalizableName, prepareT} from 'store/i18n'
import {genderizeJob} from 'store/job'
import {inCityPrefix} from 'store/french'


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
  {name: prepareT('Dans le département'), value: 'DEPARTEMENT'},
  {name: prepareT('Dans toute la région'), value: 'REGION'},
  {name: prepareT('Dans toute la France'), value: 'COUNTRY'},
  {disabled: true, name: prepareT("À l'international"), value: 'WORLD'},
]

const PROJECT_EMPLOYMENT_TYPE_OPTIONS: LocalizedSelectOption<bayes.bob.EmploymentType>[] = [
  {name: prepareT('CDI'), value: 'CDI'},
  {name: prepareT('CDD long (+ de 3 mois)'), value: 'CDD_OVER_3_MONTHS'},
  {name: prepareT('CDD court (- de 3 mois)'), value: 'CDD_LESS_EQUAL_3_MONTHS'},
  {name: prepareT('interim'), value: 'INTERIM'},
  {name: prepareT('alternance'), value: 'ALTERNANCE'},
  {name: prepareT('stage'), value: 'INTERNSHIP'},
]

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


// Keep in sync with frontend/server/scoring_base.py
const SALARY_TO_GROSS_ANNUAL_FACTORS = {
  // net = gross x 80%
  ANNUAL_GROSS_SALARY: 1,
  HOURLY_NET_SALARY: 52 * 35 / 0.8,
  MONTHLY_GROSS_SALARY: 12,
  MONTHLY_NET_SALARY: 12 / 0.8,
}


const SENIORITY = {
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
  UNKNOWN_PROJECT_SENIORITY: undefined,
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
  return short ? translate(short) : ''
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
        experience: long ? t(long) : '',
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


const flattenProject = (projectFields: bayes.bob.Project): bayes.bob.Project => ({
  city: undefined,
  employmentTypes: ['CDI'],
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


export {
  PROJECT_EXPERIENCE_OPTIONS, PROJECT_PASSIONATE_OPTIONS,
  PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_EMPLOYMENT_TYPE_OPTIONS,
  PROJECT_WORKLOAD_OPTIONS, PROJECT_KIND_OPTIONS, createProjectTitle, newProject,
  createProjectTitleComponents, getSeniorityText, SALARY_TO_GROSS_ANNUAL_FACTORS,
  TRAINING_FULFILLMENT_ESTIMATE_OPTIONS, flattenProject, SENIORITY_OPTIONS,
}

import {genderizeJob} from 'store/job'
import {inCityPrefix} from 'store/french'


interface SelectOption<T = string> {
  readonly disabled?: true
  readonly name: string
  readonly value: T
}


const PROJECT_EXPERIENCE_OPTIONS: SelectOption<bayes.bob.PreviousJobSimilarity>[] = [
  {name: "Oui, j'ai déjà fait ce métier", value: 'DONE_THIS'},
  {name: "J'ai déjà fait un métier similaire", value: 'DONE_SIMILAR'},
  {name: "C'est un nouveau métier pour moi", value: 'NEVER_DONE'},
]

const PROJECT_LOCATION_AREA_TYPE_OPTIONS: SelectOption<bayes.bob.AreaType>[] = [
  {name: 'Uniquement dans cette ville', value: 'CITY'},
  {name: 'Dans le département', value: 'DEPARTEMENT'},
  {name: 'Dans toute la région', value: 'REGION'},
  {name: 'Dans toute la France', value: 'COUNTRY'},
  {disabled: true, name: "À l'international", value: 'WORLD'},
]

const PROJECT_EMPLOYMENT_TYPE_OPTIONS: SelectOption<bayes.bob.EmploymentType>[] = [
  {name: 'CDI', value: 'CDI'},
  {name: 'CDD long (+ de 3 mois)', value: 'CDD_OVER_3_MONTHS'},
  {name: 'CDD court (- de 3 mois)', value: 'CDD_LESS_EQUAL_3_MONTHS'},
  {name: 'interim', value: 'INTERIM'},
  {name: 'alternance', value: 'ALTERNANCE'},
  {name: 'stage', value: 'INTERNSHIP'},
]

const PROJECT_KIND_OPTIONS: SelectOption<bayes.bob.ProjectKind>[] = [
  {name: 'Retrouver un emploi', value: 'FIND_A_NEW_JOB'},
  {name: 'Me reconvertir', value: 'REORIENTATION'},
  {name: 'Trouver mon premier emploi', value: 'FIND_A_FIRST_JOB'},
  {name: 'Trouver un autre emploi (je suis en poste)', value: 'FIND_ANOTHER_JOB'},
  {
    name: 'Développer ou reprendre une activité',
    value: 'CREATE_OR_TAKE_OVER_COMPANY',
  },
]


const PROJECT_WORKLOAD_OPTIONS: SelectOption<bayes.bob.ProjectWorkload>[] = [
  {name: 'à temps plein', value: 'FULL_TIME'},
  {name: 'à temps partiel', value: 'PART_TIME'},
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
  EXPERT: {
    long: "avec plus de 10 ans d'expérience",
    short: 'Plus de 10 ans',
  },
  INTERMEDIARY: {
    long: "avec entre 2 et 5 ans d'expérience",
    short: '2 à 5 ans',
  },
  INTERN: {
    long: 'avec une expérience de stage',
    short: 'Stage',
  },
  JUNIOR: {
    long: "avec moins de deux ans d'expérience",
    short: 'Moins de 2 ans',
  },
  SENIOR: {
    long: "avec entre 5 et 10 ans d'expérience",
    short: '6 à 10 ans',
  },
} as const


const SENIORITY_OPTIONS = (['INTERN', 'JUNIOR', 'INTERMEDIARY', 'SENIOR', 'EXPERT'] as const).
  map((value): SelectOption<bayes.bob.ProjectSeniority> => ({name: SENIORITY[value].short, value}))


const PROJECT_PASSIONATE_OPTIONS: SelectOption<bayes.bob.PassionateLevel>[] = [
  {name: 'Le métier de ma vie', value: 'LIFE_GOAL_JOB'},
  {name: 'Un métier passionnant', value: 'PASSIONATING_JOB'},
  {name: 'Un métier intéressant', value: 'LIKEABLE_JOB'},
  {name: 'Un métier comme un autre', value: 'ALIMENTARY_JOB'},
]


const getSeniorityText = (seniority: string): string => {
  const {short = ''} = SENIORITY[seniority] || {}
  return short
}

interface TitleComponents {
  experience?: string
  what?: string
  where?: string
}

const createProjectTitleComponents = (project: bayes.bob.Project, gender: string):
TitleComponents => {
  const {cityName, prefix} = inCityPrefix(project.city && project.city.name)
  const where = prefix + cityName
  if (project.targetJob) {
    const {long = ''} = SENIORITY[project.seniority] || {}
    return {
      experience: long,
      what: genderizeJob(project.targetJob, gender),
      where,
    }
  }
  if (project.kind === 'CREATE_COMPANY') {
    return {
      what: 'Créer une entreprise',
      where,
    }
  }
  if (project.kind === 'TAKE_OVER_COMPANY') {
    return {
      what: 'Reprendre une entreprise',
      where,
    }
  }
  if (project.kind === 'REORIENTATION') {
    return {
      what: 'Me réorienter',
      where,
    }
  }
  return {}
}


const createProjectTitle = (newProject: bayes.bob.Project, gender: bayes.bob.Gender): string => {
  const {what, where} = createProjectTitleComponents(newProject, gender)
  if (what && where) {
    return `${what} ${where}`
  }
}


const newProject =
  (newProjectData: bayes.bob.Project, gender: bayes.bob.Gender): bayes.bob.Project => {
    const {
      projectId: omittedProjectId,
      createdAt: omittedCreatedAt,
      isIncomplete: omittedIsIncomplete,
      ...cleanedProject} = newProjectData
    return {
      ...cleanedProject,
      status: 'PROJECT_CURRENT',
      title: createProjectTitle(newProjectData, gender),
    }
  }


const getTrainingFulfillmentEstimateOptions =
  (gender?: bayes.bob.Gender): SelectOption<bayes.bob.TrainingFulfillmentEstimate>[] => {
    const genderE = gender === 'FEMININE' ? 'e' : ''
    return [
      {name: "Oui, j'ai les diplômes suffisants", value: 'ENOUGH_DIPLOMAS'},
      {name: "Je ne pense pas, mais j'ai beaucoup d'expérience", value: 'ENOUGH_EXPERIENCE'},
      {name: 'Bientôt, je fais une formation pour ce poste', value: 'CURRENTLY_IN_TRAINING'},
      {name: `Je ne suis pas sûr${genderE}`, value: 'TRAINING_FULFILLMENT_NOT_SURE'},
    ]
  }


const MILLISECS_PER_MONTH = 30.5 * 24 * 60 * 60 * 1000


const isOldProject = (project: bayes.bob.Project): boolean => {
  if (!project || !project.createdAt) {
    return false
  }
  const millisecondsSinceProjectCreation = Date.now() - new Date(project.createdAt).getTime()
  return millisecondsSinceProjectCreation > 2 * MILLISECS_PER_MONTH
}


const flattenProject = (projectFields: bayes.bob.Project): bayes.bob.Project => ({
  city: null,
  employmentTypes: ['CDI'],
  kind: null,
  minSalary: null,
  passionateLevel: null,
  previousJobSimilarity: null,
  targetJob: null,
  workloads: ['FULL_TIME'],
  ...projectFields,
  createdAt: '',
  isIncomplete: true,
  projectId: '',
})


const getStrategy = (project: bayes.bob.Project, sId: string): bayes.bob.WorkingStrategy =>
  project.openedStrategies && project.openedStrategies.
    find(({strategyId}: bayes.bob.WorkingStrategy): boolean => strategyId === sId) || {}


export {
  PROJECT_EXPERIENCE_OPTIONS, PROJECT_PASSIONATE_OPTIONS,
  PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_EMPLOYMENT_TYPE_OPTIONS,
  PROJECT_WORKLOAD_OPTIONS, PROJECT_KIND_OPTIONS, createProjectTitle, newProject,
  createProjectTitleComponents, getSeniorityText, getStrategy, SALARY_TO_GROSS_ANNUAL_FACTORS,
  getTrainingFulfillmentEstimateOptions, isOldProject, flattenProject, SENIORITY_OPTIONS,
}

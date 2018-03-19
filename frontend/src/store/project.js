import {genderizeJob} from 'store/job'
import {inCityPrefix} from 'store/french'


const PROJECT_EXPERIENCE_OPTIONS = [
  {name: "Oui, j'ai déjà fait ce métier", value: 'DONE_THIS'},
  {name: "J'ai déjà fait un métier similaire", value: 'DONE_SIMILAR'},
  {name: "C'est un nouveau métier pour moi", value: 'NEVER_DONE'},
]

const PROJECT_LOCATION_AREA_TYPE_OPTIONS = [
  {name: 'Uniquement dans cette ville', value: 'CITY'},
  {name: 'Dans le département', value: 'DEPARTEMENT'},
  {name: 'Dans toute la région', value: 'REGION'},
  {name: 'Dans toute la France', value: 'COUNTRY'},
  {disabled: true, name: "À l'international", value: 'WORLD'},
]

const PROJECT_EMPLOYMENT_TYPE_OPTIONS = [
  {name: 'CDI', value: 'CDI'},
  {name: 'CDD > 3 mois', value: 'CDD_OVER_3_MONTHS'},
  {name: 'CDD <= 3 mois', value: 'CDD_LESS_EQUAL_3_MONTHS'},
  {name: 'interim', value: 'INTERIM'},
  {name: 'stage', value: 'INTERNSHIP'},
]

const PROJECT_WORKLOAD_OPTIONS = [
  {name: 'à temps plein', value: 'FULL_TIME'},
  {name: 'à temps partiel', value: 'PART_TIME'},
]

const SENIORITY = {
  EXPERT: {
    long: "avec plus de 10 ans d'expérience",
    short: 'Plus de 10 ans',
  },
  INTERMEDIARY: {
    long: "avec entre 2 et 5 ans d'expérience",
    short: 'Entre 2 et 5 ans',
  },
  INTERNSHIP: {
    long: 'avec une expérience de stage',
    short: 'Stage',
  },
  JUNIOR: {
    long: "avec moins de deux ans d'expérience",
    short: 'Moins de deux ans',
  },
  SENIOR: {
    long: "avec entre 5 et 10 ans d'expérience",
    short: 'Entre 5 et 10 ans',
  },
}


const PROJECT_PASSIONATE_OPTIONS = [
  {name: 'Le métier de ma vie', value: 'LIFE_GOAL_JOB'},
  {name: 'Un métier passionnant', value: 'PASSIONATING_JOB'},
  {name: 'Un métier intéressant', value: 'LIKEABLE_JOB'},
  {name: 'Un métier comme un autre', value: 'ALIMENTARY_JOB'},
]


function allDoneActions(projectList) {
  const allActions = [];
  (projectList || []).forEach(
    project => {
      (project.actions || []).concat(project.pastActions || []).forEach(action => {
        if (action.status === 'ACTION_DONE') {
          allActions.push({...action, project})
        }
      })
    }
  )
  return allActions
}


function getSeniorityText(seniority) {
  const {short} = SENIORITY[seniority] || {}
  return short || ''
}


function createProjectTitleComponents(project, gender) {
  const {cityName, prefix} = inCityPrefix(
    project.city && project.city.name ||
    project.mobility && project.mobility.city && project.mobility.city.name)
  const where = prefix + cityName
  if (project.targetJob) {
    const {long} = SENIORITY[project.seniority] || {}
    return {
      experience: long || '',
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


function createProjectTitle(newProject, gender) {
  const {what, where} = createProjectTitleComponents(newProject, gender)
  if (what && where) {
    return `${what} ${where}`
  }
}


function newProject(newProjectData, gender) {
  return {
    activitySector: newProjectData.activitySector,
    employmentTypes: newProjectData.employmentTypes,
    jobSearchLengthMonths: newProjectData.jobSearchLengthMonths,
    kind: newProjectData.kind,
    minSalary: newProjectData.minSalary,
    mobility: {
      areaType: newProjectData.areaType,
      city: newProjectData.city,
    },
    networkEstimate: newProjectData.networkEstimate,
    passionateLevel: newProjectData.passionateLevel,
    previousJobSimilarity: newProjectData.previousJobSimilarity,
    seniority: newProjectData.seniority,
    status: 'PROJECT_CURRENT',
    targetJob: newProjectData.targetJob,
    title: createProjectTitle(newProjectData, gender),
    totalInterviewCount: newProjectData.totalInterviewCount,
    totalInterviewsEstimate: newProjectData.totalInterviewsEstimate,
    trainingFulfillmentEstimate: newProjectData.trainingFulfillmentEstimate,
    weeklyApplicationsEstimate: newProjectData.weeklyApplicationsEstimate,
    weeklyOffersEstimate: newProjectData.weeklyOffersEstimate,
    workloads: newProjectData.workloads,
  }
}


const getTrainingFulfillmentEstimateOptions = gender => {
  const genderE = gender === 'FEMININE' ? 'e' : ''
  return [
    {name: "Oui, j'ai les diplômes suffisants", value: 'ENOUGH_DIPLOMAS'},
    {name: "Je ne pense pas, mais j'ai beaucoup d'expérience", value: 'ENOUGH_EXPERIENCE'},
    {name: 'Bientôt, je fais une formation pour ce poste', value: 'CURRENTLY_IN_TRAINING'},
    {name: `Je ne suis pas sûr${genderE}`, value: 'TRAINING_FULFILLMENT_NOT_SURE'},
  ]
}


const MILLISECS_PER_MONTH = 30.5 * 24 * 60 * 60 * 1000


function isOldProject(project) {
  if (!project || !project.createdAt) {
    return false
  }
  const millisecondsSinceProjectCreation = new Date() - new Date(project.createdAt)
  return millisecondsSinceProjectCreation > 2 * MILLISECS_PER_MONTH
}


export {
  PROJECT_EXPERIENCE_OPTIONS, PROJECT_PASSIONATE_OPTIONS,
  PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_EMPLOYMENT_TYPE_OPTIONS,
  PROJECT_WORKLOAD_OPTIONS, createProjectTitle, newProject, allDoneActions,
  createProjectTitleComponents, getSeniorityText,
  getTrainingFulfillmentEstimateOptions, isOldProject,
}

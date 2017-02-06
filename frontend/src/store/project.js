import moment from 'moment'
moment.locale('fr')

import {genderizeJob} from 'store/job'
import {inCityPrefix} from 'store/french'


const PROJECT_EXPERIENCE_OPTIONS = [
  {name: "j'ai déjà pratiqué ce métier", value: 'DONE_THIS'},
  {name: "j'ai pratiqué un métier similaire", value: 'DONE_SIMILAR'},
  {name: "c'est un nouveau métier pour moi", value: 'NEVER_DONE'},
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

function hasActionPlan(user) {
  return (user.projects || []).some(project => {
    return (project.actions || []).length || (project.pastActions || []).length
  })
}

function allActionsById(projectList) {
  const allActions = {};
  (projectList || []).forEach(project => {
    (project.actions || []).forEach(action => {
      allActions[action.actionId] = action
    });
    (project.pastActions || []).forEach(action => {
      allActions[action.actionId] = action
    })
  })
  return allActions
}

function allActiveActions(projectList) {
  const allActions = [];
  (projectList || []).forEach(
    project => (project.actions || []).forEach(
      action => {
        if (action.status !== 'ACTION_DECLINED' && action.status !== 'ACTION_SNOOZED') {
          allActions.push({
            ...action,
            isNew: action.createdAt >= project.actionsGeneratedAt,
            project,
          })
        }
      }
    )
  )
  return allActions
}

function allDoneActions(projectList) {
  const allActions = [];
  (projectList|| []).forEach(
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

// Collects all done actions as well as all done actions from projects.
function allDoneAndPastActionsAndProjects(projectList) {
  const allActions = [];
  (projectList|| []).forEach(
    project => {
      const accumulateActionWithStatus = statuses => action => {
        if (statuses[action.status]) {
          allActions.push({action, project})
        }
      }
      (project.actions || []).forEach(accumulateActionWithStatus({ACTION_DONE: true}));
      (project.pastActions || []).forEach(accumulateActionWithStatus({
        ACTION_CURRENT: true,
        ACTION_DONE: true,
        ACTION_STICKY_DONE: true,
        ACTION_STUCK: true,
        ACTION_UNREAD: true,
      }))
    }
  )
  return allActions
}


function allStickyActions(projectList) {
  return (projectList || []).reduce(
    (allActions, project) => allActions.concat((project.stickyActions || []).
      map(action => ({action, project}))),
    [])
}


function createProjectTitleComponents(project, gender) {
  const {cityName, prefix} = inCityPrefix(
    project.city && project.city.name ||
    project.mobility && project.mobility.city && project.mobility.city.name)
  const where = prefix + cityName
  if (project.kind === 'FIND_JOB') {
    return {
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
    diplomaFulfillmentEstimate: newProjectData.diplomaFulfillmentEstimate,
    employmentTypes: newProjectData.employmentTypes,
    jobSearchLengthMonths: newProjectData.jobSearchLengthMonths,
    kind: newProjectData.kind,
    minSalary: newProjectData.minSalary,
    mobility: {
      areaType: newProjectData.areaType,
      city: newProjectData.city,
    },
    networkEstimate: newProjectData.networkEstimate,
    previousJobSimilarity: newProjectData.previousJobSimilarity,
    seniority: newProjectData.seniority,
    status: 'PROJECT_CURRENT',
    targetJob: newProjectData.targetJob,
    title: createProjectTitle(newProjectData, gender),
    totalInterviewsEstimate: newProjectData.totalInterviewsEstimate,
    weeklyApplicationsEstimate: newProjectData.weeklyApplicationsEstimate,
    weeklyOffersEstimate: newProjectData.weeklyOffersEstimate,
    workloads: newProjectData.workloads,
  }
}


function projectsWithOpenActions(projects) {
  return (projects || []).
    filter(project => (project.actions || []).
      some(action => action.status === 'ACTION_UNREAD' || action.status === 'ACTION_CURRENT'))
}


function areAllActionsDoneForToday(projects, displayedProjects) {
  if (displayedProjects.length !== 0) {
    return false
  }
  if (projectsWithOpenActions(projects).length) {
    // Those projects are not displayed yet, but will be very soon.
    return false
  }
  // We do not display any actions in the dashboard, however we need to make
  // sure that at least one action was generated.
  return projects.some(project => !!project.actionsGeneratedAt)
}


function isAnyActionPlanGeneratedRecently(projects) {
  return (projects || []).some(project => {
    // Can also be implemented without moment.
    const actionsGeneratedAtMoment = moment(project.actionsGeneratedAt)
    return moment().diff(actionsGeneratedAtMoment, 'seconds') < 30
  })
}


function isNewActionPlanNeeded(projects) {
  return (projects || []).some(project => {
    if (!project.actionsGeneratedAt) {
      for (const chantier in project.activatedChantiers) {
        if (project.activatedChantiers[chantier]) {
          return true
        }
      }
      return false
    }
    const actionsGeneratedAtMoment = moment(project.actionsGeneratedAt)
    return moment().startOf('day').isAfter(actionsGeneratedAtMoment)
  })
}


function findAction(projects, action) {
  return (projects || []).reduce((actionFound, project) => {
    if (actionFound) {
      return actionFound
    }
    const isSearchedAction = anAction => anAction.actionId === action.actionId

    const currentAction = (project.actions || []).find(isSearchedAction)
    if (currentAction) {
      return currentAction
    }

    const stickyAction = (project.stickyActions || []).find(isSearchedAction)
    if (stickyAction) {
      return stickyAction
    }

    const pastAction = (project.pastActions || []).find(isSearchedAction)
    if (pastAction) {
      return pastAction
    }

    return null
  }, null)
}


function finishStickyStepInAction(action, finishedStep, text) {
  return {
    ...action,
    steps: action.steps.map(step => {
      if (step.stepId !== finishedStep.stepId) {
        return step
      }
      return {
        ...step,
        isDone: true,
        text: text || '',
      }
    }),
  }
}


function finishStickyActionStep(project, finishedStep, text) {
  const isTargetedAction = action => (action.steps || []).
    some(step => step.stepId === finishedStep.stepId)

  // Let's check if this a sticky from an advice.
  let inAdvice = false
  const advices = (project.advices || []).map(advice => {
    if (!advice.engagementAction || !isTargetedAction(advice.engagementAction)) {
      return advice
    }
    inAdvice = true
    const engagementAction = finishStickyStepInAction(advice.engagementAction, finishedStep, text)
    const isActionDone = !engagementAction.steps.some(step => !step.isDone)
    if (isActionDone) {
      engagementAction.status = 'ACTION_STICKY_DONE'
    }
    return {
      ...advice,
      engagementAction,
      status: isActionDone ? 'ADVICE_ENGAGED' : advice.status,
    }
  })
  if (inAdvice) {
    return {...project, advices}
  }

  const stepAction = (project.stickyActions || []).find(isTargetedAction)
  if (!stepAction) {
    return project
  }

  const finishedStepAction = finishStickyStepInAction(stepAction, finishedStep, text)

  if (finishedStepAction.steps.some(step => !step.isDone)) {
    // There are still steps to do.
    return {
      ...project,
      stickyActions: project.stickyActions.map(
        stickyAction => stickyAction.actionId === stepAction.actionId ?
          finishedStepAction : stickyAction),
    }
  }

  // Action is finished.
  return {
    ...project,
    ...(project.adviceStatus === 'ADVICE_ACCEPTED' ? {adviceStatus: 'ADVICE_ENGAGED'} : {}),
    pastActions: (project.pastActions || []).concat([{
      ...finishedStepAction,
      status: 'ACTION_STICKY_DONE',
    }]),
    stickyActions: project.stickyActions.filter(
      stickyAction => stickyAction.actionId !== stepAction.actionId),
  }
}


function nextAdviceToRecommend(project) {
  const isRecommended = ({status, engagementAction}) =>
    status === 'ADVICE_RECOMMENDED' || status === 'ADVICE_ACCEPTED' && !engagementAction

  if (project.advices) {
    for (let recommendationNumber = 1;
        recommendationNumber <= project.advices.length;
        ++recommendationNumber) {
      const advice = project.advices[recommendationNumber - 1]
      if (isRecommended(advice)) {
        return {advice, recommendationNumber}
      }
    }
  }

  return null
}


function getAdviceById(advice, project) {
  return (project.advices || []).
    find(updatedAdvice => advice.adviceId === updatedAdvice.adviceId)
}


function hasUserEverAcceptedAdvice(project) {
  const wasAcceptedStatus = status =>
    status === 'ADVICE_ACCEPTED' || status === 'ADVICE_ENGAGED' || status === 'ADVICE_CANCELED'
  return wasAcceptedStatus(project.adviceStatus) ||
    (project.advices || []).some(advice => wasAcceptedStatus(advice.status))
}


export {
  PROJECT_EXPERIENCE_OPTIONS,
  PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_EMPLOYMENT_TYPE_OPTIONS,
  PROJECT_WORKLOAD_OPTIONS, createProjectTitle, newProject, allActiveActions,
  allDoneAndPastActionsAndProjects, allActionsById, projectsWithOpenActions,
  areAllActionsDoneForToday, allDoneActions, hasActionPlan,
  isAnyActionPlanGeneratedRecently, isNewActionPlanNeeded,
  allStickyActions, findAction, finishStickyActionStep, nextAdviceToRecommend,
  getAdviceById, hasUserEverAcceptedAdvice, createProjectTitleComponents,
}

/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
import {createProjectTitle, PROJECT_EMPLOYMENT_TYPE_OPTIONS, allActionsById,
        allActiveActions, areAllActionsDoneForToday, isNewActionPlanNeeded} from 'store/project'
const {EmploymentType} = require('api/job')

describe('createProjectTitle', () => {

  const createNewProject = () => {
    return {
      areaType: 'CITY',
      city: {
        departementName: 'Sarthe',
        name: 'Rennes',
        regionName: 'Pays de la Loire',
      },
      kind: 'FIND_JOB',
      targetJob: {
        feminineName: 'Pâtissière',
        masculineName: 'Pâtissier',
        name: 'Pâtissier / Pâtissière',
      },
    }
  }

  it('should include the job and the city when looking for a job with areaType CITY', () => {
    const title = createProjectTitle(createNewProject(), 'MASCULINE')
    expect(title).to.equal('Pâtissier à Rennes')
  })

  it('should use a contracted form for the city if needed', () => {
    const newProject = createNewProject()
    newProject.city.name = 'Le Mans'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Pâtissier au Mans')
  })

  it('should use a lowercase when the city starts with a prefix', () => {
    const newProject = createNewProject()
    newProject.city.name = 'La Rochelle'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Pâtissier à la Rochelle')
  })

  it('nothing fancy even if the job starts with a vowel', () => {
    const newProject = createNewProject()
    newProject.targetJob.masculineName = 'Écrivain'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Écrivain à Rennes')
  })

  it('should include the job but not the departement when areaType is DEPARTEMENT', () => {
    const newProject = createNewProject()
    newProject.areaType = 'DEPARTEMENT'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Pâtissier à Rennes')
  })

  it('should mention that they want to create their own company, if they are up for that', () => {
    const newProject = createNewProject()
    newProject.kind = 'CREATE_COMPANY'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Créer une entreprise à Rennes')
  })

  it('should mention that they want to take over a company, if they are up for that', () => {
    const newProject = createNewProject()
    newProject.kind = 'TAKE_OVER_COMPANY'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Reprendre une entreprise à Rennes')
  })

  it('should mention that they want to do a re-orientation, if they are up for that', () => {
    const newProject = createNewProject()
    newProject.kind = 'REORIENTATION'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Me réorienter à Rennes')
  })
})


describe('Collect all active actions from a list of projects', () => {

  it('should exclude declined and snoozed actions', () => {
    const projectList = [
      {
        actions: [
          {status: 'ACTION_UNREAD'},
          {status: 'ACTION_SNOOZED'},
          {status: 'ACTION_DECLINED'},
        ],
      },
    ]
    const actions = allActiveActions(projectList)
    expect(actions.length).to.equal(1)
  })

  it('should collect actions from several projects', () => {
    const projectList = [
      {
        actions: [{status: 'ACTION_UNREAD'}],
      },
      {
        actions: [{status: 'ACTION_UNREAD'}],
      },
    ]
    const actions = allActiveActions(projectList)
    expect(actions.length).to.equal(2)
  })
})


describe('PROJECT_EMPLOYMENT_TYPE_OPTIONS', () => {
  it('should contain identifiers in values, not in names', () => {
    PROJECT_EMPLOYMENT_TYPE_OPTIONS.forEach(({name, value}) => {
      expect(EmploymentType).to.have.property(value)
      expect(name).not.to.match(/^[A-Z0-9]*_[A-Z0-9_]*$/)
    })
  })
})


describe('areAllactionsDoneForToday', () => {
  const projectWithNoActions = {title: 'Project With No Actions'}
  const projectWithOpenAction = {
    actions: [{'status': 'ACTION_UNREAD'}],
    actionsGeneratedAt: 'today',
    title: 'Project with Open Actions',
  }
  const projectWithDoneAction = {
    actions: [{'status': 'ACTION_DONE'}],
    actionsGeneratedAt: 'today',
    title: 'Project with Open Actions',
  }

  it('should return false when no actions have been generated yet', () => {
    const actual = areAllActionsDoneForToday([projectWithNoActions], [])
    expect(actual).to.be.false
  })

  it('should return false when there are still some visible actions', () => {
    const actual = areAllActionsDoneForToday([projectWithDoneAction], [projectWithOpenAction])
    expect(actual).to.be.false
  })

  it('should return true when are no more displayed actions but they have been done.', () => {
    const actual = areAllActionsDoneForToday([projectWithDoneAction], [])
    expect(actual).to.be.true
  })

  it('should return false when we just added new actions', () => {
    const actual = areAllActionsDoneForToday([projectWithOpenAction], [])
    expect(actual).to.be.false
  })
})


describe('allActionsById', () => {
  it('should index actions by ID', () => {
    const user = {
      projects: [{
        actions: [{
          actionId: 'action-id',
          title: "Let's do it!",
        }],
      }],
    }
    const action = allActionsById(user.projects)['action-id']
    expect(action).to.be.ok
    expect(action.title).to.equal("Let's do it!")
  })

  it('should alson index old actions', () => {
    const user = {
      projects: [{
        pastActions: [{
          actionId: 'action-id',
          title: "Let's do it!",
        }],
      }],
    }
    const action = allActionsById(user.projects)['action-id']
    expect(action).to.be.ok
    expect(action.title).to.equal("Let's do it!")
  })
})


describe('isNewActionPlanNeeded', () => {
  it('should not ask for a new plan if no projects yet', () => {
    const actual = isNewActionPlanNeeded(undefined)
    expect(actual).not.to.be.ok
  })

  it('should not ask for a new plan if no chantiers selected yet', () => {
    const actual = isNewActionPlanNeeded([{}])
    expect(actual).not.to.be.ok
  })

  it('should ask for a new plan if chantiers are selected but no actions yet', () => {
    const actual = isNewActionPlanNeeded([{
      activatedChantiers: {bar: true, foo: true},
    }])
    expect(actual).to.be.ok
  })

  it('should ask for a new plan if actions have been generated a while ago', () => {
    const actual = isNewActionPlanNeeded([{
      actionsGeneratedAt: '2016-11-10T12:14:16.188223Z',
      activatedChantiers: {bar: true, foo: true},
    }])
    expect(actual).to.be.ok
  })
})

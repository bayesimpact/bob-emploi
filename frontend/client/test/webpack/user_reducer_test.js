import {config, expect} from 'chai'
import {userReducer} from 'store/user_reducer'
import {CREATE_PROJECT, EDIT_FIRST_PROJECT, DIAGNOSE_ONBOARDING,
  MODIFY_PROJECT, REPLACE_STRATEGY} from 'store/actions'

config.truncateThreshold = 0

describe('user reducer', () => {
  it('should return unchanged state for an unknown action', () => {
    const action = {type: 'SOME_UNKNOWN_ACTION'}
    const oldState = {foo: 'bar'}
    const newState = userReducer(oldState, action)
    expect(newState).to.deep.equal(oldState)
  })

  it('should not add a new project when there is already one', () => {
    const action = {project: {title: 'new project'}, type: CREATE_PROJECT}
    const oldState = {foo: 'bar', projects: [{title: 'a project'}]}
    const newState = userReducer(oldState, action)
    expect(newState.projects.length).to.equal(1)
    expect(newState.projects[0].title).to.equal('a project')
    expect(newState.foo).to.equal('bar')
  })

  it('should add a first project', () => {
    const action = {project: {title: 'new project'}, type: CREATE_PROJECT}
    const oldState = {foo: 'bar'}
    const newState = userReducer(oldState, action)
    expect(newState.projects.length).to.equal(1)
    expect(newState.projects[0].title).to.equal('new project')
    expect(newState.foo).to.equal('bar')
  })

  it('should not edit a complete project', () => {
    const action = {project: {title: 'new project'}, type: EDIT_FIRST_PROJECT}
    const oldState = {foo: 'bar', projects: [{title: 'a project'}]}
    const newState = userReducer(oldState, action)
    expect(newState.projects.length).to.equal(1)
    expect(newState.projects[0].title).to.equal('a project')
    expect(newState.foo).to.equal('bar')
  })

  it('should edit an incomplete project', () => {
    const action = {project: {title: 'new project'}, type: EDIT_FIRST_PROJECT}
    const oldState = {
      foo: 'bar',
      projects: [{isIncomplete: true, target: 'job', title: 'a project'}],
    }
    const newState = userReducer(oldState, action)
    expect(newState.projects.length).to.equal(1)
    expect(newState.projects[0].title).to.equal('new project')
    expect(newState.projects[0].target).to.be.undefined
    expect(newState.foo).to.equal('bar')
  })

  it('should create an incomplete project on first edit', () => {
    const action = {project: {title: 'new project'}, type: EDIT_FIRST_PROJECT}
    const oldState = {foo: 'bar'}
    const newState = userReducer(oldState, action)
    expect(newState.projects.length).to.equal(1)
    expect(newState.projects[0].title).to.equal('new project')
    expect(newState.projects[0].isIncomplete).to.equal(true)
    expect(newState.foo).to.equal('bar')
  })

  it('should update a project when modifying a previously complete project', () => {
    const action = {project: {projectId: '0'}, type: MODIFY_PROJECT}
    const oldState = {projects: [{
      advices: [{}],
      diagnostic: {},
      localStats: {},
      projectId: '0',
      strategies: [{}],
    }]}
    const newState = userReducer(oldState, action)
    expect(newState.projects[0].projectId).to.equal('0')
    expect(newState.projects[0].isIncomplete).to.be.true
    expect(newState.projects[0].advices).to.eql([])
    expect(newState.projects[0].diagnostic).to.be.null
    expect(newState.projects[0].localStats).to.be.null
    expect(newState.projects[0].strategies).to.eql([])
    expect(newState.revision).to.equal(1)
  })

  describe('diagnoseOnboarding', () => {

    it('should update user profile', () => {
      const action = {type: DIAGNOSE_ONBOARDING, user: {profile: {gender: 'MASCULINE'}}}
      const oldState = {profile: {gender: 'FEMININE', name: 'Nathalie'}}
      const newState = userReducer(oldState, action)
      expect(newState.profile.gender).to.equal('MASCULINE')
      expect(newState.profile.name).to.equal('Nathalie')
      expect(newState.revision).to.equal(1)
    })

    it('should update project', () => {
      const action = {type: DIAGNOSE_ONBOARDING, user: {projects: [{title: 'Hello World'}]}}
      const oldState = {projects: [{isIncomplete: true}]}
      const newState = userReducer(oldState, action)
      expect(newState.projects[0].isIncomplete).to.be.true
      expect(newState.projects[0].title).to.equal('Hello World')
      expect(newState.revision).to.equal(1)
    })

    it('should update a project when modifying a previously complete project', () => {
      const action = {type: DIAGNOSE_ONBOARDING, user: {projects: [{title: 'Hello World'}]}}
      const oldState = {projects: [{
        // The project is incomplete as user has decided to modify it.
        isIncomplete: true,
        // The project has a project ID because it has been complete by the past.
        projectId: '0',
      }]}
      const newState = userReducer(oldState, action)
      expect(newState.projects[0].projectId).to.equal('0')
      expect(newState.projects[0].isIncomplete).to.be.true
      expect(newState.projects[0].title).to.equal('Hello World')
      expect(newState.revision).to.equal(1)
    })

    it('should replace an opened strategy', () => {
      const action = {
        project: {projectId: '0'},
        response: {
          reachedGoals: {'goal1': true},
          startedAt: '2019-04-13T12:00:00Z',
          strategyId: 'other-leads',
        },
        status: 'success',
        type: REPLACE_STRATEGY,
      }
      const oldState = {projects: [{
        openedStrategies: [{
          reachedGoals: {},
          startedAt: '2019-04-12T12:00:00Z',
          strategyId: 'other-leads',
        }],
        projectId: '0',
      }]}
      const newState = userReducer(oldState, action)
      expect(newState.projects[0].openedStrategies[0].strategyId).to.equal('other-leads')
      expect(newState.projects[0].openedStrategies[0].reachedGoals).to.have.property('goal1')
      expect(newState.projects[0].openedStrategies[0].startedAt).to.equal('2019-04-13T12:00:00Z')
    })

    it('should create a newly opened strategy', () => {
      const action = {
        project: {projectId: '0'},
        response: {
          reachedGoals: {'goal1': true},
          startedAt: '2019-04-13T12:00:00Z',
          strategyId: 'other-leads',
        },
        status: 'success',
        type: REPLACE_STRATEGY,
      }
      const oldState = {projects: [{
        openedStrategies: [{
          reachedGoals: {},
          startedAt: '2019-04-12T12:00:00Z',
          strategyId: 'presearch-methods',
        }],
        projectId: '0',
      }]}
      const newState = userReducer(oldState, action)
      expect(newState.projects[0].openedStrategies[1].strategyId).to.equal('other-leads')
      expect(newState.projects[0].openedStrategies[1].reachedGoals).to.have.property('goal1')
      expect(newState.projects[0].openedStrategies[1].startedAt).to.equal('2019-04-13T12:00:00Z')
    })

  })
})

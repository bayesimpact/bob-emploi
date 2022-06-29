import {config, expect} from 'chai'
import userReducer from 'store/user_reducer'
import type {ReplaceStrategyAction} from 'store/actions'

config.truncateThreshold = 0

const getFirstProject = (user: bayes.bob.User): bayes.bob.Project => {
  expect(user.projects).to.be.ok
  expect(user.projects![0]).to.be.ok
  return user.projects![0]!
}

const getOpenedStrategy = (project: bayes.bob.Project, index = 0): bayes.bob.WorkingStrategy => {
  expect(project.openedStrategies).to.be.ok
  expect(project.openedStrategies![index]).to.be.ok
  return project.openedStrategies![index]!
}

const getProfile = (user: bayes.bob.User): bayes.bob.UserProfile => {
  expect(user.profile).to.be.ok
  return user.profile!
}

describe('user reducer', (): void => {
  it('should return unchanged state for an unknown action', (): void => {
    const action = {type: 'SOME_UNKNOWN_ACTION'} as const
    const oldState = {googleId: 'bar'} as const
    // @ts-ignore Testing an unknown action on purpose.
    const newState = userReducer(oldState, action)
    expect(newState).to.deep.equal(oldState)
  })

  it('should not add a new project when there is already one', (): void => {
    const action = {project: {title: 'new project'}, type: 'CREATE_PROJECT'} as const
    const oldState = {googleId: 'bar', projects: [{title: 'a project'}]} as const
    const newState = userReducer(oldState, action)
    expect(newState.googleId).to.equal('bar')
    const project = getFirstProject(newState)
    expect(project.title).to.equal('a project')
  })

  it('should add a first project', (): void => {
    const action = {project: {title: 'new project'}, type: 'CREATE_PROJECT'} as const
    const oldState = {googleId: 'bar'} as const
    const newState = userReducer(oldState, action)
    expect(newState.googleId).to.equal('bar')
    const project = getFirstProject(newState)
    expect(project.title).to.equal('new project')
  })

  it('should not edit a complete project', (): void => {
    const action = {project: {title: 'new project'}, type: 'EDIT_FIRST_PROJECT'} as const
    const oldState = {googleId: 'bar', projects: [{title: 'a project'}]}
    const newState = userReducer(oldState, action)
    expect(newState.googleId).to.equal('bar')
    const project = getFirstProject(newState)
    expect(project.title).to.equal('a project')
  })

  it('should edit an incomplete project', (): void => {
    const action = {project: {title: 'new project'}, type: 'EDIT_FIRST_PROJECT'} as const
    const oldState = {
      googleId: 'bar',
      projects: [{isIncomplete: true, target: 'job', title: 'a project'}],
    }
    const newState = userReducer(oldState, action)
    expect(newState.projects).to.be.ok
    expect(newState.projects!.length).to.equal(1)
    expect(newState.googleId).to.equal('bar')
    const project = getFirstProject(newState)
    expect(project.title).to.equal('new project')
    // @ts-ignore
    expect(project.target).to.be.undefined
  })

  it('should create an incomplete project on first edit', (): void => {
    const action = {project: {title: 'new project'}, type: 'EDIT_FIRST_PROJECT'} as const
    const oldState = {googleId: 'bar'} as const
    const newState = userReducer(oldState, action)
    expect(newState.googleId).to.equal('bar')
    const project = getFirstProject(newState)
    expect(project.title).to.equal('new project')
    expect(project.isIncomplete).to.equal(true)
  })

  it('should update a project when modifying a previously complete project', (): void => {
    const action = {project: {projectId: '0'}, type: 'MODIFY_PROJECT'} as const
    const oldState = {projects: [{
      advices: [{}],
      diagnostic: {},
      localStats: {},
      projectId: '0',
      strategies: [{}],
    }]} as const
    const newState = userReducer(oldState, action)
    expect(newState.revision).to.equal(1)
    const project = getFirstProject(newState)
    expect(project.projectId).to.equal('0')
    expect(project.isIncomplete).to.be.true
    expect(project.advices).to.eql([])
    expect(project.diagnostic).to.be.undefined
    expect(project.localStats).to.be.undefined
    expect(project.strategies).to.eql([])
  })

  describe('diagnoseOnboarding', (): void => {
    it('should update user profile', (): void => {
      const action = {
        ASYNC_MARKER: 'ASYNC_MARKER',
        type: 'DIAGNOSE_ONBOARDING',
        user: {profile: {gender: 'MASCULINE'}},
      } as const
      const oldState = {profile: {gender: 'FEMININE', name: 'Nathalie'}} as const
      const newState = userReducer(oldState, action)
      const profile = getProfile(newState)
      expect(profile.gender).to.equal('MASCULINE')
      expect(profile.name).to.equal('Nathalie')
      expect(newState.revision).to.equal(1)
    })

    it('should update project', (): void => {
      const action = {
        ASYNC_MARKER: 'ASYNC_MARKER',
        type: 'DIAGNOSE_ONBOARDING',
        user: {projects: [{title: 'Hello World'}]},
      } as const
      const oldState = {projects: [{isIncomplete: true}]}
      const newState = userReducer(oldState, action)
      const project = getFirstProject(newState)
      expect(project.isIncomplete).to.be.true
      expect(project.title).to.equal('Hello World')
      expect(newState.revision).to.equal(1)
    })

    it('should update a project when modifying a previously complete project', (): void => {
      const action = {
        ASYNC_MARKER: 'ASYNC_MARKER',
        type: 'DIAGNOSE_ONBOARDING',
        user: {projects: [{title: 'Hello World'}]},
      } as const
      const oldState = {projects: [{
        // The project is incomplete as user has decided to modify it.
        isIncomplete: true,
        // The project has a project ID because it has been complete by the past.
        projectId: '0',
      }]}
      const newState = userReducer(oldState, action)
      const project = getFirstProject(newState)
      expect(project.projectId).to.equal('0')
      expect(project.isIncomplete).to.be.true
      expect(project.title).to.equal('Hello World')
      expect(newState.revision).to.equal(1)
    })

    it('should replace an opened strategy', (): void => {
      const action: ReplaceStrategyAction = {
        ASYNC_MARKER: 'ASYNC_MARKER',
        project: {projectId: '0'},
        response: {
          reachedGoals: {goal1: true},
          startedAt: '2019-04-13T12:00:00Z',
          strategyId: 'other-leads',
        },
        status: 'success',
        strategy: {
          strategyId: 'other-leads',
        },
        type: 'REPLACE_STRATEGY',
      } as const
      const oldState = {projects: [{
        openedStrategies: [{
          reachedGoals: {},
          startedAt: '2019-04-12T12:00:00Z',
          strategyId: 'other-leads',
        }],
        projectId: '0',
      }]} as const
      const newState = userReducer(oldState, action)
      const strategy = getOpenedStrategy(getFirstProject(newState))
      expect(strategy.strategyId).to.equal('other-leads')
      expect(strategy.reachedGoals).to.have.property('goal1')
      expect(strategy.startedAt).to.equal('2019-04-13T12:00:00Z')
    })

    it('should create a newly opened strategy', (): void => {
      const action: ReplaceStrategyAction = {
        ASYNC_MARKER: 'ASYNC_MARKER',
        project: {projectId: '0'},
        response: {
          reachedGoals: {goal1: true},
          startedAt: '2019-04-13T12:00:00Z',
          strategyId: 'other-leads',
        },
        status: 'success',
        strategy: {
          strategyId: 'other-leads',
        },
        type: 'REPLACE_STRATEGY',
      } as const
      const oldState = {projects: [{
        openedStrategies: [{
          reachedGoals: {},
          startedAt: '2019-04-12T12:00:00Z',
          strategyId: 'presearch-methods',
        }],
        projectId: '0',
      }]} as const
      const newState = userReducer(oldState, action)
      const strategy = getOpenedStrategy(getFirstProject(newState), 1)
      expect(strategy.strategyId).to.equal('other-leads')
      expect(strategy.reachedGoals).to.have.property('goal1')
      expect(strategy.startedAt).to.equal('2019-04-13T12:00:00Z')
    })
  })
})

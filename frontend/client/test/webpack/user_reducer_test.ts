import {config, expect} from 'chai'
import {userReducer} from 'store/user_reducer'
import {ReplaceStrategyAction} from 'store/actions'

config.truncateThreshold = 0

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
    expect(newState.projects).to.be.ok
    expect(newState.projects!.length).to.equal(1)
    expect(newState.projects![0].title).to.equal('a project')
    expect(newState.googleId).to.equal('bar')
  })

  it('should add a first project', (): void => {
    const action = {project: {title: 'new project'}, type: 'CREATE_PROJECT'} as const
    const oldState = {googleId: 'bar'} as const
    const newState = userReducer(oldState, action)
    expect(newState.projects).to.be.ok
    expect(newState.projects!.length).to.equal(1)
    expect(newState.projects![0].title).to.equal('new project')
    expect(newState.googleId).to.equal('bar')
  })

  it('should not edit a complete project', (): void => {
    const action = {project: {title: 'new project'}, type: 'EDIT_FIRST_PROJECT'} as const
    const oldState = {googleId: 'bar', projects: [{title: 'a project'}]}
    const newState = userReducer(oldState, action)
    expect(newState.projects).to.be.ok
    expect(newState.projects!.length).to.equal(1)
    expect(newState.projects![0].title).to.equal('a project')
    expect(newState.googleId).to.equal('bar')
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
    expect(newState.projects![0].title).to.equal('new project')
    // @ts-ignore
    expect(newState.projects![0].target).to.be.undefined
    expect(newState.googleId).to.equal('bar')
  })

  it('should create an incomplete project on first edit', (): void => {
    const action = {project: {title: 'new project'}, type: 'EDIT_FIRST_PROJECT'} as const
    const oldState = {googleId: 'bar'} as const
    const newState = userReducer(oldState, action)
    expect(newState.projects).to.be.ok
    expect(newState.projects!.length).to.equal(1)
    expect(newState.projects![0].title).to.equal('new project')
    expect(newState.projects![0].isIncomplete).to.equal(true)
    expect(newState.googleId).to.equal('bar')
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
    expect(newState.projects).to.be.ok
    expect(newState.projects![0].projectId).to.equal('0')
    expect(newState.projects![0].isIncomplete).to.be.true
    expect(newState.projects![0].advices).to.eql([])
    expect(newState.projects![0].diagnostic).to.be.undefined
    expect(newState.projects![0].localStats).to.be.undefined
    expect(newState.projects![0].strategies).to.eql([])
    expect(newState.revision).to.equal(1)
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
      expect(newState.profile).to.be.ok
      expect(newState.profile!.gender).to.equal('MASCULINE')
      expect(newState.profile!.name).to.equal('Nathalie')
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
      expect(newState.projects).to.be.ok
      expect(newState.projects![0].isIncomplete).to.be.true
      expect(newState.projects![0].title).to.equal('Hello World')
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
      expect(newState.projects).to.be.ok
      expect(newState.projects![0].projectId).to.equal('0')
      expect(newState.projects![0].isIncomplete).to.be.true
      expect(newState.projects![0].title).to.equal('Hello World')
      expect(newState.revision).to.equal(1)
    })

    it('should replace an opened strategy', (): void => {
      const action: ReplaceStrategyAction = {
        ASYNC_MARKER: 'ASYNC_MARKER',
        project: {projectId: '0'},
        response: {
          reachedGoals: {'goal1': true},
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
      expect(newState.projects).to.be.ok
      expect(newState.projects![0].openedStrategies).to.be.ok
      expect(newState.projects![0].openedStrategies![0].strategyId).to.equal('other-leads')
      expect(newState.projects![0].openedStrategies![0].reachedGoals).to.have.property('goal1')
      expect(newState.projects![0].openedStrategies![0].startedAt).to.equal('2019-04-13T12:00:00Z')
    })

    it('should create a newly opened strategy', (): void => {
      const action: ReplaceStrategyAction = {
        ASYNC_MARKER: 'ASYNC_MARKER',
        project: {projectId: '0'},
        response: {
          reachedGoals: {'goal1': true},
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
      expect(newState.projects).to.be.ok
      expect(newState.projects![0].openedStrategies).to.be.ok
      expect(newState.projects![0].openedStrategies![1].strategyId).to.equal('other-leads')
      expect(newState.projects![0].openedStrategies![1].reachedGoals).to.have.property('goal1')
      expect(newState.projects![0].openedStrategies![1].startedAt).to.equal('2019-04-13T12:00:00Z')
    })

  })
})

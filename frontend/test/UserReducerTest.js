/* eslint-env mocha */
var chai = require('chai')
var expect = chai.expect
chai.config.truncateThreshold = 0
import {user} from 'store/user_reducer'
import {CREATE_PROJECT, DECLINE_ADVICE, STOP_STICKY_ACTION} from 'store/actions'

describe('user reducer', () => {
  it('should return unchanged state for an unknown action', () => {
    const action = {type: 'SOME_UNKNOWN_ACTION'}
    const oldState = {foo: 'bar'}
    const newState = user(oldState, action)
    expect(newState).to.deep.equal(oldState)
  })

  it('should add a new project', () => {
    const action = {project: {title: 'new project'}, type: CREATE_PROJECT}
    const oldState = {foo: 'bar', projects: [{title: 'a project'}]}
    const newState = user(oldState, action)
    expect(newState.projects.length).to.equal(2)
    expect(newState.projects[1].title).to.equal('new project')
    expect(newState.foo).to.equal('bar')
  })

  it('should stop a sticky action', () => {
    const oldState = {
      projects: [
        {stickyActions: [{actionId: 'active'}]},
        {stickyActions: [{actionId: 'to-stop'}]},
      ],
    }
    const action = {action: {actionId: 'to-stop'}, type: STOP_STICKY_ACTION}
    const newState = user(oldState, action)
    expect(newState).to.deep.equal({
      projects: [
        {stickyActions: [{actionId: 'active'}]},
        {pastActions: [{actionId: 'to-stop'}], stickyActions: []},
      ],
    })
  })

  it('should decline an advice', () => {
    const oldState = {
      projects: [{
        advices: [
          {adviceId: 'organize', status: 'ADVICE_ACCEPTED'},
          {adviceId: 'reorientation', status: 'ADVICE_RECOMMENDED'},
        ],
        projectId: 'foo',
      }],
    }
    const action = {
      advice: {adviceId: 'reorientation'},
      project: {projectId: 'foo'},
      reason: 'boooring',
      type: DECLINE_ADVICE,
    }
    const newState = user(oldState, action)
    expect(newState).to.deep.equal({
      projects: [{
        advices: [
          {adviceId: 'organize', status: 'ADVICE_ACCEPTED'},
          {
            adviceId: 'reorientation',
            declinedReason: 'boooring',
            status: 'ADVICE_DECLINED',
          },
        ],
        projectId: 'foo',
      }],
    })
  })
})


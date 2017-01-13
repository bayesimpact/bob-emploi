/* eslint-env mocha */
var chai = require('chai')
var expect = chai.expect
import {user} from 'store/user_reducer'
import {CREATE_PROJECT} from 'store/actions'

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
})


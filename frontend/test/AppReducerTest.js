var chai = require('chai')
var expect = chai.expect
import {app} from 'store/app_reducer'
import {GET_ADVICE_TIPS} from 'store/actions'


describe('app reducer', () => {
  const appInitialData = app(undefined, {type: 'INIT'})

  it('should cache advice tips', () => {
    const action = {
      ASYNC_MARKER: 'ASYNC_MARKER',
      advice: {adviceId: 'other-work-env'},
      project: {projectId: 'project-id'},
      response: ['tip1', 'tip2'],
      status: 'success',
      type: GET_ADVICE_TIPS,
    }
    const newState = app(appInitialData, action)
    expect(newState.adviceTips).to.deep.equal({
      'project-id': {
        'other-work-env': ['tip1', 'tip2'],
      },
    })
  })

  it('should erase only tips for the same project and advice', () => {
    const action = {
      ASYNC_MARKER: 'ASYNC_MARKER',
      advice: {adviceId: 'other-work-env'},
      project: {projectId: 'project-id'},
      response: ['tip1', 'tip2'],
      status: 'success',
      type: GET_ADVICE_TIPS,
    }
    const oldState = {
      adviceTips: {
        'other-project': {
          'other-work-env': ['stable'],
        },
        'project-id': {
          'other-work-env': ['old', 'value'],
          'unrelated-advice': ['no-change'],
        },
      },
    }
    const newState = app(oldState, action)
    expect(newState.adviceTips).to.deep.equal({
      'other-project': {
        'other-work-env': ['stable'],
      },
      'project-id': {
        'other-work-env': ['tip1', 'tip2'],
        'unrelated-advice': ['no-change'],
      },
    })
  })
})

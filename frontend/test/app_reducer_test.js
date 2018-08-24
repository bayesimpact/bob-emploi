import chai from 'chai'
import {app} from 'store/app_reducer'
import {DIAGNOSE_ONBOARDING, GET_ADVICE_TIPS} from 'store/actions'

const expect = chai.expect


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

  it('should add onboarding comments', () => {
    const action = {
      response: {
        comments: [
          {
            comment: {stringParts: ['Bonjour ', 'Angèle', ', comment vas-tu ?']},
            field: 'TARGET_JOB_FIELD',
            isBeforeQuestion: true,
          },
          {
            comment: {stringParts: ['Bonjour ', 'Angèle', ', comment vas-tu ?']},
            field: 'CITY_FIELD',
          },
        ],
      },
      status: 'success',
      type: DIAGNOSE_ONBOARDING,
    }
    const oldState = {
      quickDiagnostic: {
        after: {},
        before: {},
      },
    }
    const newState = app(oldState, action)
    expect(newState.quickDiagnostic).to.deep.equal({
      after: {
        CITY_FIELD: {
          comment: {stringParts: ['Bonjour ', 'Angèle', ', comment vas-tu ?']},
          field: 'CITY_FIELD',
        },
      },
      before: {
        TARGET_JOB_FIELD: {
          comment: {stringParts: ['Bonjour ', 'Angèle', ', comment vas-tu ?']},
          field: 'TARGET_JOB_FIELD',
          isBeforeQuestion: true,
        },
      },
    })
  })

  it('should override onboarding comments', () => {
    const action = {
      response: {
        comments: [{
          comment: {stringParts: ['Bonjour ', 'Angèle', ' je sais plus de trucs, maintenant']},
          field: 'TARGET_JOB_FIELD',
          isBeforeQuestion: true,
        }],
      },
      status: 'success',
      type: DIAGNOSE_ONBOARDING,
    }
    const oldState = {
      quickDiagnostic: {
        after: {},
        before: {
          TARGET_JOB_FIELD: {
            comment: {stringParts: ['Bonjour ', 'Angèle', ', comment vas-tu ?']},
            field: 'TARGET_JOB_FIELD',
            isBeforeQuestion: true,
          },
        },
      },
    }
    const newState = app(oldState, action)
    expect(newState.quickDiagnostic).to.deep.equal({
      after: {},
      before: {
        TARGET_JOB_FIELD: {
          comment: {stringParts: ['Bonjour ', 'Angèle', ' je sais plus de trucs, maintenant']},
          field: 'TARGET_JOB_FIELD',
          isBeforeQuestion: true,
        },
      },
    })
  })
})

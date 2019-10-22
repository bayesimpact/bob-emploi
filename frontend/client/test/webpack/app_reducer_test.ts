import chai from 'chai'
import {app} from 'store/app_reducer'
import {DiagnoseOnboardingAction, GetAdviceTipsAction} from 'store/actions'

const expect = chai.expect


describe('app reducer', (): void => {
  const appInitialData = app(undefined, {location: {pathname: '/'}, type: 'PAGE_IS_LOADED'})

  it('should cache advice tips', (): void => {
    const action: GetAdviceTipsAction = {
      ASYNC_MARKER: 'ASYNC_MARKER',
      advice: {adviceId: 'other-work-env'},
      project: {projectId: 'project-id'},
      response: [{actionId: 'tip1'}, {actionId: 'tip2'}],
      status: 'success',
      type: 'GET_ADVICE_TIPS',
    }
    const newState = app(appInitialData, action)
    expect(newState.adviceTips).to.deep.equal({
      'project-id': {
        'other-work-env': [{actionId: 'tip1'}, {actionId: 'tip2'}],
      },
    })
  })

  it('should erase only tips for the same project and advice', (): void => {
    const action: GetAdviceTipsAction = {
      ASYNC_MARKER: 'ASYNC_MARKER',
      advice: {adviceId: 'other-work-env'},
      project: {projectId: 'project-id'},
      response: [{actionId: 'tip1'}, {actionId: 'tip2'}],
      status: 'success',
      type: 'GET_ADVICE_TIPS',
    } as const
    const oldState = {
      adviceData: {},
      adviceTips: {
        'other-project': {
          'other-work-env': [{actionId: 'stable'}],
        },
        'project-id': {
          'other-work-env': [{actionId: 'old'}, {actionId: 'value'}],
          'unrelated-advice': [{actionId: 'no-change'}],
        },
      },
    }
    const newState = app(oldState, action)
    expect(newState.adviceTips).to.deep.equal({
      'other-project': {
        'other-work-env': [{actionId: 'stable'}],
      },
      'project-id': {
        'other-work-env': [{actionId: 'tip1'}, {actionId: 'tip2'}],
        'unrelated-advice': [{actionId: 'no-change'}],
      },
    })
  })

  it('should add onboarding comments', (): void => {
    const action: DiagnoseOnboardingAction = {
      ASYNC_MARKER: 'ASYNC_MARKER',
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
      type: 'DIAGNOSE_ONBOARDING',
      user: {},
    }
    const oldState = {
      adviceData: {},
      quickDiagnostic: {
        after: {},
        before: {},
      },
    } as const
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

  it('should override onboarding comments', (): void => {
    const action: DiagnoseOnboardingAction = {
      ASYNC_MARKER: 'ASYNC_MARKER',
      response: {
        comments: [{
          comment: {stringParts: ['Bonjour ', 'Angèle', ' je sais plus de trucs, maintenant']},
          field: 'TARGET_JOB_FIELD',
          isBeforeQuestion: true,
        }],
      },
      status: 'success',
      type: 'DIAGNOSE_ONBOARDING',
      user: {},
    }
    const oldState = {
      adviceData: {},
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

import {expect} from 'chai'
import type {GoogleLoginResponse} from 'react-google-login'
import type {ThunkAction} from 'redux-thunk'

import type {AllActions, AsyncAction, RootState} from 'store/actions'
import {asyncAuthenticate, getDefinedFieldsPath, googleAuthenticateUser} from 'store/actions'


const defaultRootState: RootState = {
  app: {
    adviceData: {},
  },
  asyncState: {
    errorMessage: undefined,
    isFetching: {},
  },
  user: {},
}


// Capture an asynchronous action: it actually dispatches two actions, the
// first one before the asynchronous action with ASYNC_MARKER, and a second
// one containing the response once it's done. This capture function returns
// a promise of the response contained in the second one.
async function captureAsyncAction<T extends string, R, A extends AsyncAction<T, R> & AllActions>(
  action: ThunkAction<Promise<R|void>, RootState, unknown, A>,
  state: RootState = defaultRootState): Promise<R|void> {
  const dispatched: AllActions[] = []
  const dispatch = (actionDispatched: ThunkAction<Promise<R|void>, RootState, unknown, A>|A):
  Promise<R|void>|void => {
    if (typeof actionDispatched === 'function') {
      return actionDispatched(dispatch, (): RootState => state, {})
    }
    dispatched.push(actionDispatched)
  }
  const promise = dispatch(action)
  expect(promise).to.be.ok
  if (!promise) {
    return
  }
  const response = await promise
  const firstDispatchedAction = dispatched[0] as A

  expect(firstDispatchedAction.ASYNC_MARKER).to.be.ok
  expect(firstDispatchedAction.status).not.to.be.ok

  const secondDispatchedAction = dispatched[1] as A
  expect(secondDispatchedAction.ASYNC_MARKER).to.be.ok
  expect(secondDispatchedAction.status).to.equal('success')
  return response
}


describe('getDefinedFieldsPath', (): void => {
  it('should get simple and nested fields', (): void => {
    const paths = getDefinedFieldsPath({a: 1, b: {c: 2}})
    expect(paths).to.deep.equal(['a', 'b.c'])
  })

  it('should get a field even if its value is falsy except for undefined', (): void => {
    const paths = getDefinedFieldsPath({a: false, b: undefined, c: [], d: null, e: 0, f: '', g: {}})
    expect(paths).to.deep.equal(['a', 'c', 'd', 'e', 'f', 'g'])
  })

  it('should not dive into repeated fields', (): void => {
    const paths = getDefinedFieldsPath({a: [1, 2, 3], b: [{c: 1}]})
    expect(paths).to.deep.equal(['a', 'b'])
  })
})


describe('googleAuthenticateUser action generator', (): void => {
  // Mock the server API when accessing the user/authenticate endpoint to sign
  // in with Facebook.
  const mockApi = {
    userAuthenticate: ({googleTokenId}: bayes.bob.AuthRequest): Promise<bayes.bob.AuthResponse> => {
      expect(googleTokenId).to.equal('mlkdfh')
      return new Promise((resolve): void => {
        setTimeout((): void => resolve({authenticatedUser: {googleId: '123'}}))
      })
    },
  }

  const mockGoogleLoginResponse = {
    getAuthResponse: (): ReturnType<GoogleLoginResponse['getAuthResponse']> =>
      // eslint-disable-next-line camelcase
      ({id_token: 'mlkdfh'} as ReturnType<GoogleLoginResponse['getAuthResponse']>),
    getId(): string {
      return ''
    },
    isSignedIn(): boolean {
      return true
    },
  } as GoogleLoginResponse

  it('should set the first and last name of the user', async (): Promise<void> => {
    const action = googleAuthenticateUser({
      ...mockGoogleLoginResponse,
      getBasicProfile: (): ReturnType<GoogleLoginResponse['getBasicProfile']> => ({
        getEmail: (): string => 'corpet@gmail.com',
        getFamilyName: (): string => 'Corpet',
        getGivenName: (): string => 'Pascal',
        getId: (): string => '123',
        getImageUrl: (): string => '',
        getName: (): string => 'Pascal Corpet',
      }),
    }, mockApi)
    const response = await captureAsyncAction(action)
    expect(response).to.deep.equal({authenticatedUser: {
      googleId: '123',
      profile: {
        lastName: 'Corpet',
        name: 'Pascal',
      },
    }})
  })

  it('should populate the names even if the Google account does not have any',
    async (): Promise<void> => {
      const action = googleAuthenticateUser({
        ...mockGoogleLoginResponse,
        getBasicProfile: (): ReturnType<GoogleLoginResponse['getBasicProfile']> => ({
          getEmail: (): string => 'corpet@gmail.com',
          getFamilyName: (): string => '',
          getGivenName: (): string => '',
          getId: (): string => '123',
        } as ReturnType<GoogleLoginResponse['getBasicProfile']>),
      }, mockApi)
      const response = await captureAsyncAction(action)
      expect(response).to.deep.equal({authenticatedUser: {
        googleId: '123',
        profile: {
          lastName: ' ',
          name: 'corpet',
        },
      }})
    })
})

// A fake authenticate function that returns some fields from its input.
const forwardAuthenticate =
({authToken, userId}: bayes.bob.AuthRequest): Promise<bayes.bob.AuthResponse> => Promise.resolve({
  ...authToken && {authToken},
  ...userId && {authenticatedUser: {userId}},
})

// TODO(cyrille): Add more tests.
describe('asyncAuthenticate', () => {
  it('should add authToken from state when user is guest', async () => {
    const token = 'some token'
    const userId = 'userId'
    const state: RootState = {
      ...defaultRootState,
      app: {
        ...defaultRootState.app,
        authToken: token,
      },
      user: {
        ...defaultRootState.user,
        hasAccount: false,
        userId,
      },
    }
    const action = asyncAuthenticate(forwardAuthenticate, {}, 'password')
    const response = await captureAsyncAction(action, state)
    expect(response).to.deep.equal({authToken: token, authenticatedUser: {userId}})
  })

  it('should add authToken from state when creating a password', async () => {
    const token = 'some token'
    const userId = 'userId'
    const state: RootState = {
      ...defaultRootState,
      app: {
        ...defaultRootState.app,
        authToken: token,
      },
      user: {
        ...defaultRootState.user,
        hasAccount: true,
        hasPassword: false,
        userId,
      },
    }
    const action = asyncAuthenticate(forwardAuthenticate, {}, 'password')
    const response = await captureAsyncAction(action, state)
    expect(response).to.deep.equal({authToken: token, authenticatedUser: {userId}})
  })

  it('should not add token if user already has a password', async () => {
    const token = 'some token'
    const userId = 'userId'
    const state: RootState = {
      ...defaultRootState,
      app: {
        ...defaultRootState.app,
        authToken: token,
      },
      user: {
        ...defaultRootState.user,
        hasAccount: true,
        hasPassword: true,
        userId,
      },
    }
    const action = asyncAuthenticate(forwardAuthenticate, {}, 'password')
    const response = await captureAsyncAction(action, state)
    expect(response).to.deep.equal({})
  })
})

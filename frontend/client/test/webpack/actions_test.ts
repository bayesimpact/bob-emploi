import {expect} from 'chai'
import {AllActions, AsyncAction, RootState, asyncAuthenticate, getDefinedFieldsPath,
  googleAuthenticateUser} from 'store/actions'


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
function captureAsyncAction<T extends string, R, A extends AsyncAction<T, R>>(
  action, state: RootState = defaultRootState): Promise<R> {
  const dispatched: AllActions[] = []
  const dispatch = (actionDispatched): Promise<R> | void => {
    if (typeof actionDispatched === 'function') {
      return actionDispatched(dispatch, (): RootState => state)
    }
    dispatched.push(actionDispatched)
  }
  // @ts-ignore
  return dispatch(action).then((response: R): R => {
    const firstDispatchedAction = dispatched[0] as A

    expect(firstDispatchedAction.ASYNC_MARKER).to.be.ok
    expect(firstDispatchedAction.status).not.to.be.ok

    const secondDispatchedAction = dispatched[1] as A
    expect(secondDispatchedAction.ASYNC_MARKER).to.be.ok
    expect(secondDispatchedAction.status).to.equal('success')
    return response
  })
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
    userAuthenticate: ({googleTokenId}): Promise<bayes.bob.AuthResponse> => {
      expect(googleTokenId).to.equal('mlkdfh')
      return new Promise((resolve): void => {
        setTimeout((): void => resolve({authenticatedUser: {googleId: '123'}}))
      })
    },
  }

  it('should set the first and last name of the user', (): Promise<void> => {
    const action = googleAuthenticateUser({
      getAuthResponse: (): {'id_token': string} => ({'id_token': 'mlkdfh'}),
      getBasicProfile: (): {} => ({
        getFamilyName: (): string => 'Corpet',
        getGivenName: (): string => 'Pascal',
        getId: (): string => '123',
      }),
    }, mockApi)
    return captureAsyncAction(action).then((response): void => {
      expect(response).to.deep.equal({authenticatedUser: {
        googleId: '123',
        profile: {
          lastName: 'Corpet',
          name: 'Pascal',
        },
      }})
    })
  })

  it('should populate the names even if the Google account does not have any',
    (): Promise<void> => {
      const action = googleAuthenticateUser({
        getAuthResponse: (): {'id_token': string} => ({'id_token': 'mlkdfh'}),
        getBasicProfile: (): {} => ({
          getEmail: (): string => 'corpet@gmail.com',
          getFamilyName: (): void => undefined,
          getGivenName: (): void => undefined,
          getId: (): string => '123',
        }),
      }, mockApi)
      return captureAsyncAction(action).then((response): void => {
        expect(response).to.deep.equal({authenticatedUser: {
          googleId: '123',
          profile: {
            lastName: ' ',
            name: 'corpet',
          },
        }})
      })
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
  it('should add authToken from state when user is guest', () => {
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
    const action = asyncAuthenticate(forwardAuthenticate, {}, 'some method')
    return captureAsyncAction(action, state).then((response): void => {
      expect(response).to.deep.equal({authToken: token, authenticatedUser: {userId}})
    })
  })

  it('should add authToken from state when creating a password', () => {
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
    return captureAsyncAction(action, state).then((response): void => {
      expect(response).to.deep.equal({authToken: token, authenticatedUser: {userId}})
    })
  })

  it('should not add token if user already has a password', () => {
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
    return captureAsyncAction(action, state).then((response): void => {
      expect(response).to.deep.equal({})
    })
  })
})

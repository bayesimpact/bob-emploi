import {expect} from 'chai'
import {facebookAuthenticateUser, googleAuthenticateUser} from 'store/actions'


// Capture an asynchronous action: it actually dispatches two actions, the
// first one before the asynchronous action with ASYNC_MARKER, and a second
// one containing the response once it's done. This capture function returns
// a promise of the response contained in the second one.
const captureAsyncAction = action => {
  const dispatched = []
  const dispatch = actionDispatched => dispatched.push(actionDispatched)
  return action(dispatch).then(() => {
    expect(dispatched.length).to.equal(2)

    expect(dispatched[0].ASYNC_MARKER).to.be.ok
    expect(dispatched[0].status).not.to.be.ok

    expect(dispatched[1].ASYNC_MARKER).to.be.ok
    expect(dispatched[1].status).to.equal('success')
    return dispatched[1].response
  })
}


describe('facebookAuthenticateUser action generator', () => {
  const facebookAuth = {email: 'pascal@facebook.com', id: '123', signedRequest: 'mlkdfh'}
  // Mock the server API when accessing the user/authenticate endpoint to sign
  // in with Facebook.
  const mockApi = {
    userAuthenticate: ({email, facebookSignedRequest}) => {
      expect(email).to.equal('pascal@facebook.com')
      expect(facebookSignedRequest).to.equal('mlkdfh')
      return new Promise(resolve => {
        setTimeout(() => resolve({authenticatedUser: {facebookId: '123'}}))
      })
    },
  }

  it('should set the year of birth from the Facebook birthday field', () => {
    const action = facebookAuthenticateUser({...facebookAuth, birthday: '1982'}, mockApi)
    return captureAsyncAction(action).then(response => {
      expect(response).to.deep.equal({authenticatedUser: {
        facebookId: '123',
        profile: {email: 'pascal@facebook.com', yearOfBirth: 1982},
      }})
    })
  })

  it('should set the year of birth from the Facebook birthday field in MM/DD/YYYY format', () => {
    const action = facebookAuthenticateUser({...facebookAuth, birthday: '05/15/1982'}, mockApi)
    return captureAsyncAction(action).then(response => {
      expect(response).to.deep.equal({authenticatedUser: {
        facebookId: '123',
        profile: {email: 'pascal@facebook.com', yearOfBirth: 1982},
      }})
    })
  })

  it('should not set the year of birth from the Facebook birthday field in MM/DD format', () => {
    const action = facebookAuthenticateUser({...facebookAuth, birthday: '05/15'}, mockApi)
    return captureAsyncAction(action).then(response => {
      expect(response).to.deep.equal({authenticatedUser: {
        facebookId: '123',
        profile: {email: 'pascal@facebook.com'},
      }})
    })
  })
})


describe('googleAuthenticateUser action generator', () => {
  // Mock the server API when accessing the user/authenticate endpoint to sign
  // in with Facebook.
  const mockApi = {
    userAuthenticate: ({googleTokenId}) => {
      expect(googleTokenId).to.equal('mlkdfh')
      return new Promise(resolve => {
        setTimeout(() => resolve({authenticatedUser: {googleId: '123'}}))
      })
    },
  }

  it('should set the first and last name of the user', () => {
    const action = googleAuthenticateUser({
      getAuthResponse: () => ({'id_token': 'mlkdfh'}),
      getBasicProfile: () => ({
        getFamilyName: () => 'Corpet',
        getGivenName: () => 'Pascal',
        getId: () => '123',
      }),
    }, mockApi)
    return captureAsyncAction(action).then(response => {
      expect(response).to.deep.equal({authenticatedUser: {
        googleId: '123',
        profile: {
          lastName: 'Corpet',
          name: 'Pascal',
        },
      }})
    })
  })

  it('should populate the names even if the Google account does not have any', () => {
    const action = googleAuthenticateUser({
      getAuthResponse: () => ({'id_token': 'mlkdfh'}),
      getBasicProfile: () => ({
        getEmail: () => 'corpet@gmail.com',
        getFamilyName: () => undefined,
        getGivenName: () => undefined,
        getId: () => '123',
      }),
    }, mockApi)
    return captureAsyncAction(action).then(response => {
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

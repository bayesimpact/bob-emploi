var chai = require('chai')
var expect = chai.expect
import {facebookAuthenticateUser} from 'store/actions'


describe('facebookAuthenticateUser action generator', () => {
  const facebookAuth = {id: '123', signedRequest: 'mlkdfh'}
  // Mock the server API when accessing the user/authenticate endpoint to sign
  // in with Facebook.
  const mockApi = {
    userAuthenticate: ({facebookSignedRequest}) => {
      expect(facebookSignedRequest).to.equal('mlkdfh')
      return new Promise(resolve => {
        setTimeout(() => resolve({authenticatedUser: {facebookId: '123'}}))
      })
    },
  }

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

  it('should set the year of birth from the Facebook birthday field', () => {
    const action = facebookAuthenticateUser({...facebookAuth, birthday: '1982'}, mockApi)
    return captureAsyncAction(action).then(response => {
      expect(response).to.deep.equal({authenticatedUser: {
        facebookId: '123',
        profile: {yearOfBirth: 1982},
      }})
    })
  })

  it('should set the year of birth from the Facebook birthday field in MM/DD/YYYY format', () => {
    const action = facebookAuthenticateUser({...facebookAuth, birthday: '05/15/1982'}, mockApi)
    return captureAsyncAction(action).then(response => {
      expect(response).to.deep.equal({authenticatedUser: {
        facebookId: '123',
        profile: {yearOfBirth: 1982},
      }})
    })
  })

  it('should not set the year of birth from the Facebook birthday field in MM/DD format', () => {
    const action = facebookAuthenticateUser({...facebookAuth, birthday: '05/15'}, mockApi)
    return captureAsyncAction(action).then(response => {
      expect(response).to.deep.equal({authenticatedUser: {
        facebookId: '123',
        profile: {},
      }})
    })
  })
})

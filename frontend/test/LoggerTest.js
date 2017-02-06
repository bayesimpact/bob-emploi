/* eslint-env mocha */
var chai = require('chai')
var expect = chai.expect
import {Logger} from 'store/logging'


describe('Logger', () => {
  it('flatten the features flag always the same way', () => {
    const logger = new Logger([])
    const userProperties = logger.getUserProperties({}, {user: {
      featuresEnabled: {
        email: true,
        // eslint-disable-next-line sort-keys
        alpha: true,
      },
      profile: {},
      userId: 'foo',
    }})
    expect(userProperties.Features).to.eql(['alpha', 'email'])
  })
})


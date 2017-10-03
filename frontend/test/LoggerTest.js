import {expect} from 'chai'
import {Logger, daysSince} from 'store/logging'
import moment from 'moment'

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

describe('daysSince', () => {
  it('count the number of days elapsed since a given timestamp', () => {
    const threeDaysAgo = moment().subtract(3, 'days').valueOf()
    expect(daysSince(threeDaysAgo)).to.eql(3)
  })
})


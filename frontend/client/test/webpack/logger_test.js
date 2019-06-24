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

  it("extracts the action's project data", () => {
    const logger = new Logger([])
    const eventProperties = logger.getEventProperties({
      project: {
        city: {name: 'Troyes'},
        targetJob: {masculineName: 'Pompier'},
      },
    }, {})
    expect(eventProperties['Project Job Name']).to.eq('Pompier')
    expect(eventProperties['Project City']).to.eq('Troyes')
  })

  it("does not crash when the action's project data is incomplete", () => {
    const logger = new Logger([])
    logger.getEventProperties({project: {}}, {})
  })
})

describe('daysSince', () => {
  it('count the number of days elapsed since a given timestamp', () => {
    const threeDaysAgo = moment().subtract(3, 'days').valueOf()
    expect(daysSince(threeDaysAgo)).to.eql(3)
  })
})


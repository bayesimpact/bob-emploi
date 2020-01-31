import {expect} from 'chai'
import {RootState} from 'store/actions'
import {Logger, daysSince} from 'store/logging'
import moment from 'moment'

describe('Logger', (): void => {
  const emptyState: RootState = {
    app: {
      adviceData: {},
    },
    asyncState: {
      errorMessage: undefined,
      isFetching: {},
      pendingFetch: {},
    },
    user: {},
  }

  it('flatten the features flag always the same way', (): void => {
    const logger = new Logger({})
    const userProperties = logger.getUserProperties({type: 'HIDE_TOASTER_MESSAGE'}, {
      ...emptyState,
      user: {
        featuresEnabled: {
          alpha: true,
          emailNotifications: true,
        },
        profile: {},
        userId: 'foo',
      },
    })
    expect(userProperties).to.be.ok
    expect(userProperties!.Features).to.eql(['alpha', 'emailNotifications'])
  })

  it("extracts the action's project data", (): void => {
    const logger = new Logger({})
    const eventProperties = logger.getEventProperties({
      project: {
        city: {name: 'Troyes'},
        targetJob: {masculineName: 'Pompier'},
      },
      type: 'DIAGNOSTIC_TALK_IS_SHOWN',
    }, emptyState)
    expect(eventProperties['Project Job Name']).to.eq('Pompier')
    expect(eventProperties['Project City']).to.eq('Troyes')
  })

  it("does not crash when the action's project data is incomplete", (): void => {
    const logger = new Logger({})
    logger.getEventProperties({project: {}, type: 'DIAGNOSTIC_TALK_IS_SHOWN'}, emptyState)
  })
})

describe('daysSince', (): void => {
  it('count the number of days elapsed since a given timestamp', (): void => {
    const threeDaysAgo = moment().subtract(3, 'days').valueOf()
    expect(daysSince(threeDaysAgo)).to.eql(3)
  })
})


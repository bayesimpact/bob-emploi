import {expect} from 'chai'
import {DURATION_TEXT} from 'store/action_plan'

// @ts-ignore
import {ActionDuration} from 'api/action'

describe('durations', (): void => {
  const allKnownDurations = Object.keys(ActionDuration)
  const describedDurations = Object.keys(DURATION_TEXT)

  it('covers all durations', (): void => {
    expect(describedDurations.length).to.equal(allKnownDurations.length)
  })
})

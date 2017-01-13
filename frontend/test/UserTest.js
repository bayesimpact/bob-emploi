/* eslint-env mocha */
var chai = require('chai')
var expect = chai.expect
import {hasActivelySearchingSinceIfNeeded, travelInTime} from 'store/user'

describe('user helpers', () => {
  it('should need a activelySearchingSince date if actively searching', () => {
    const result = hasActivelySearchingSinceIfNeeded(null, 'ACTIVE')
    expect(result).to.equal(false)
  })

  it('should not need a activelySearchingSince date if in passive mode', () => {
    const result = hasActivelySearchingSinceIfNeeded(null, 'PASSIVE')
    expect(result).to.equal(true)
  })
})


describe('travelInTime', () => {
  it('should add a delta to a date', () => {
    const result = travelInTime('2016-10-14T13:56:37.956Z', 60 * 1000)
    expect(result).to.equal('2016-10-14T13:57:37.956Z')
  })

  it('should add a delta to a date field', () => {
    const user = {
      createdAt: '2016-10-14T13:56:00.956Z',
    }
    const result = travelInTime(user, 42 * 1000)
    expect(result).to.eql({
      createdAt: '2016-10-14T13:56:42.956Z',
    })
  })

  it('should add a delta to all dates in an array', () => {
    const user = [
      '2016-10-14T13:56:00.956Z',
      '2016-10-14T13:57:00.956Z',
      '2016-10-14T13:58:00.956Z',
    ]
    const result = travelInTime(user, 42 * 1000)
    expect(result).to.eql([
      '2016-10-14T13:56:42.956Z',
      '2016-10-14T13:57:42.956Z',
      '2016-10-14T13:58:42.956Z',
    ])
  })

  it('should add a delta to dates embedded in a complex structure', () => {
    const user = {
      createdAt: '2016-10-14T13:56:00.956Z',
      projects: [
        {updatedAt: '2016-10-14T13:57:00.956Z'},
        {updatedAt: '2016-10-14T13:58:00.956Z'},
      ],
    }
    const result = travelInTime(user, 42 * 1000)
    expect(result).to.eql({
      createdAt: '2016-10-14T13:56:42.956Z',
      projects: [
        {updatedAt: '2016-10-14T13:57:42.956Z'},
        {updatedAt: '2016-10-14T13:58:42.956Z'},
      ],
    })
  })

  it('should not modify things that are not timestamps', () => {
    ['simple text', 1234, '1234', new Date(), true].forEach(value => {
      expect(value).to.eql(travelInTime(value, 42 * 1000))
    })
  })
})

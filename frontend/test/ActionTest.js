/* eslint-env mocha */
var chai = require('chai')
var expect = chai.expect
import {actionHistoryDate, stickyProgress} from 'store/action'


describe('actionHistoryDate', () => {
  it('keeps only the date part of the timestamp', () => {
    const action = {
      createdAt: '2016-11-22T16:56:46.297772Z',
      status: 'ACTION_DONE',
      stoppedAt: '2016-11-24T16:56:46.297772Z',
    }
    const actual = actionHistoryDate(action)
    expect(actual).to.equal('2016-11-24')
  })

  it('uses the created_at field for open actions', () => {
    const action = {
      createdAt: '2016-11-22T16:56:46.297772Z',
      status: 'ACTION_UNREAD',
      stoppedAt: '2016-11-24T16:56:46.297772Z',
    }
    const actual = actionHistoryDate(action)
    expect(actual).to.equal('2016-11-22')
  })
})


describe('stickyProgress', () => {
  it('returns 0 if there are no steps', () => {
    expect(stickyProgress({})).to.equal(0)
    expect(stickyProgress({steps: []})).to.equal(0)
  })

  it('returns almost 0 if there are no steps done', () => {
    expect(stickyProgress({steps: [{}]})).to.equal(.02)
  })

  it('returns almost 0.5 if half of the steps are done', () => {
    expect(stickyProgress({steps: [{isDone: true}, {}]})).to.equal(.51)
  })

  it('returns 1 if all the steps are done', () => {
    expect(stickyProgress({steps: [{isDone: true}, {isDone: true}]})).to.equal(1)
  })
})

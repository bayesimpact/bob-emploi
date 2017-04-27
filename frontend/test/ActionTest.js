var chai = require('chai')
var expect = chai.expect
import {stickyProgress} from 'store/action'


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

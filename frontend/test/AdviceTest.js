var chai = require('chai')
var expect = chai.expect
import {priorityTitle} from 'store/advice'


describe('priorityTitle', () => {
  it('shows "À regarder" when less than 2 stars', () => {
    expect(priorityTitle({numStars: 1}, 1)).to.equal('À regarder')
    expect(priorityTitle({numStars: 0}, 1)).to.equal('À regarder')
  })

  it('shows the priority number when 2 stars or more', () => {
    expect(priorityTitle({numStars: 2}, 1)).to.equal('Priorité n°1')
    expect(priorityTitle({numStars: 3}, 1)).to.equal('Priorité n°1')
    expect(priorityTitle({numStars: 2}, 3)).to.equal('Priorité n°3')
  })

  it('does not crash if numStars is missing', () => {
    expect(priorityTitle({})).to.equal('À regarder')
  })
})

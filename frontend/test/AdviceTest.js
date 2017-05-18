const chai = require('chai')
const expect = chai.expect
import {getAdviceTitle} from 'store/advice'

describe('getAdviceTitle', () => {
  it('returns a different title depending on the number of stars', () => {
    const title1Star = getAdviceTitle({adviceId: 'other-work-env', numStars: 1})
    const title2Stars = getAdviceTitle({adviceId: 'other-work-env', numStars: 2})
    const title3Stars = getAdviceTitle({adviceId: 'other-work-env', numStars: 3})
    expect(title1Star).to.be.ok
    expect(title2Stars).to.be.ok
    expect(title3Stars).to.be.ok
    expect(title2Stars).not.to.eq(title1Star)
    expect(title3Stars).not.to.eq(title2Stars)
    expect(title1Star).not.to.eq(title3Stars)
  })

  it('returns a title even if no stars are specified', () => {
    expect(getAdviceTitle({adviceId: 'other-work-env'})).to.be.ok
  })
})

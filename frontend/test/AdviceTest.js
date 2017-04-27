const chai = require('chai')
const expect = chai.expect
import {getAdviceTitle, getAdviceScorePriority, isAnyAdviceScored} from 'store/advice'

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

describe('getAdviceScorePriority', () => {
  it('returns a different title depending on the score of the advice', () => {
    const titleGood = getAdviceScorePriority(1)
    const titleMedium = getAdviceScorePriority(5)
    const titleBad = getAdviceScorePriority(8)
    expect(titleGood).to.be.ok
    expect(titleMedium).to.be.ok
    expect(titleBad).to.be.ok
    expect(titleGood).not.to.eq(titleMedium)
    expect(titleBad).not.to.eq(titleGood)
    expect(titleBad).not.to.eq(titleMedium)
  })
})

describe('isAnyAdviceScored', () => {
  it('returns true if one of the advices is scored', () => {
    expect(isAnyAdviceScored({advices: [
      {adviceId: 'spontaneous-application'} ,
      {adviceId: 'other-work-env', score: 1}]})).to.be.true
  })

  it('returns false if an advice is not scored', () => {
    expect(isAnyAdviceScored({advices: [{adviceId: 'other-work-env'}]})).to.be.false
  })

  it('returns false if there are no advices', () => {
    expect(isAnyAdviceScored({advices: []})).to.be.false
  })
})

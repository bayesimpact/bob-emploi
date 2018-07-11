import {expect} from 'chai'
import {getAdviceShortTitle, getAdviceTitle} from 'store/advice'


describe('getAdviceTitle', () => {
  it('returns a different title depending on the number of stars', () => {
    const title1Star = getAdviceTitle({adviceId: 'commute', numStars: 1})
    const title2Stars = getAdviceTitle({adviceId: 'commute', numStars: 2})
    const title3Stars = getAdviceTitle({adviceId: 'commute', numStars: 3})
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

  it('prefers a title defined on the advice itself', () => {
    const title = getAdviceTitle({adviceId: 'network-application', numStars: 1, title: 'yep'})
    expect(title).to.eq('yep')
  })
})


describe('getAdviceShortTitle', () => {
  it('returns a title', () => {
    expect(getAdviceShortTitle({adviceId: 'other-work-env'})).to.be.ok
  })

  it('prefers a title defined on the advice itself', () => {
    const title = getAdviceShortTitle({
      adviceId: 'network-application',
      numStars: 1,
      shortTitle: 'yep',
    })
    expect(title).to.eq('yep')
  })
})

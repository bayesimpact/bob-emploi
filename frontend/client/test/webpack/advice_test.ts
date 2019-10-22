import {expect} from 'chai'
import {getAdviceGoal, getAdviceShortTitle,
  getAdviceTitle} from 'store/advice'


const tutoyer = <T>(tu: T): T => tu


describe('getAdviceTitle', (): void => {
  it('returns a different title depending on the number of stars', (): void => {
    const title1Star = getAdviceTitle({adviceId: 'life-balance', numStars: 1}, tutoyer)
    const title2Stars = getAdviceTitle({adviceId: 'life-balance', numStars: 2}, tutoyer)
    const title3Stars = getAdviceTitle({adviceId: 'life-balance', numStars: 3}, tutoyer)
    expect(title1Star).to.be.ok
    expect(title2Stars).to.be.ok
    expect(title3Stars).to.be.ok
    expect(title2Stars).not.to.eq(title1Star)
    expect(title3Stars).not.to.eq(title2Stars)
    expect(title1Star).not.to.eq(title3Stars)
  })

  it('returns a title even if no stars are specified', (): void => {
    expect(getAdviceTitle({adviceId: 'other-work-env'}, tutoyer)).to.be.ok
  })

  it('prefers a title defined on the advice itself', (): void => {
    const title = getAdviceTitle(
      {adviceId: 'network-application', numStars: 1, title: 'yep'}, tutoyer)
    expect(title).to.eq('yep')
  })
})


describe('getAdviceShortTitle', (): void => {
  it('returns a title', (): void => {
    expect(getAdviceShortTitle({adviceId: 'other-work-env'}, tutoyer)).to.be.ok
  })

  it('prefers a title defined on the advice itself', (): void => {
    const title = getAdviceShortTitle({
      adviceId: 'network-application',
      numStars: 1,
      shortTitle: 'yep',
    }, tutoyer)
    expect(title).to.eq('yep')
  })
})


describe('getAdviceGoal', (): void => {
  it('returns a goal', (): void => {
    expect(getAdviceGoal({adviceId: 'specific-to-job'}, tutoyer)).to.be.ok
  })

  it('prefers a goal defined on the advice itself', (): void => {
    const goal = getAdviceGoal({
      adviceId: 'network-application',
      goal: 'yep',
      numStars: 1,
    }, tutoyer)
    expect(goal).to.eq('yep')
  })
})

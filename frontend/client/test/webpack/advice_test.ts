import {expect} from 'chai'
import i18n, {TFunction} from 'i18next'
import {getAdviceGoal, getAdviceShortTitle, getAdviceTitle} from 'store/advice'

import {ADVICE_MODULES} from 'components/advisor'


i18n.init({
  keySeparator: false,
  lng: 'fr',
  nsSeparator: false,
  resources: {},
})


describe('getAdviceTitle', (): void => {
  let t: TFunction

  before((): void => {
    i18n.addResourceBundle('fr', 'adviceModules', {})
    t = i18n.getFixedT('fr', 'translation')
  })

  it('returns a different title depending on the number of stars', (): void => {
    const title1Star = getAdviceTitle({adviceId: 'life-balance', numStars: 1}, t)
    const title2Stars = getAdviceTitle({adviceId: 'life-balance', numStars: 2}, t)
    const title3Stars = getAdviceTitle({adviceId: 'life-balance', numStars: 3}, t)
    expect(title1Star).to.be.ok
    expect(title2Stars).to.be.ok
    expect(title3Stars).to.be.ok
    expect(title2Stars).not.to.eq(title1Star)
    expect(title3Stars).not.to.eq(title2Stars)
    expect(title1Star).not.to.eq(title3Stars)
  })

  it('returns a title even if no stars are specified', (): void => {
    expect(getAdviceTitle({adviceId: 'other-work-env'}, t)).to.be.ok
  })

  it('prefers a title defined on the advice itself', (): void => {
    const title = getAdviceTitle({adviceId: 'network-application', numStars: 1, title: 'yep'}, t)
    expect(title).to.eq('yep')
  })

  Object.keys(ADVICE_MODULES).map((adviceId): ReturnType<typeof it> =>
    it('returns a non-empty title for advice ' + adviceId, (): void => {
      const title = getAdviceTitle({adviceId}, t)
      expect(title).to.not.be.empty
    }))
})


describe('getAdviceShortTitle', (): void => {
  let t: TFunction

  before((): void => {
    i18n.addResourceBundle('fr', 'adviceModules', {})
    t = i18n.getFixedT('fr', 'translation')
  })

  it('returns a title', (): void => {
    expect(getAdviceShortTitle({adviceId: 'other-work-env'}, t)).to.be.ok
  })

  it('prefers a title defined on the advice itself', (): void => {
    const title = getAdviceShortTitle({
      adviceId: 'network-application',
      numStars: 1,
      shortTitle: 'yep',
    }, t)
    expect(title).to.eq('yep')
  })

  Object.keys(ADVICE_MODULES).map((adviceId): ReturnType<typeof it> =>
    it('returns a non-empty title for advice ' + adviceId, (): void => {
      const title = getAdviceShortTitle({adviceId}, t)
      expect(title).to.not.be.empty
    }))
})


describe('getAdviceGoal', (): void => {
  let t: TFunction

  before((): void => {
    i18n.addResourceBundle('fr', 'adviceModules', {})
    t = i18n.getFixedT('fr', 'translation')
  })

  it('returns a goal', (): void => {
    expect(getAdviceGoal({adviceId: 'specific-to-job'}, t)).to.be.ok
  })

  it('prefers a goal defined on the advice itself', (): void => {
    const goal = getAdviceGoal({
      adviceId: 'network-application',
      goal: 'yep',
      numStars: 1,
    }, t)
    expect(goal).to.eq('yep')
  })

  Object.keys(ADVICE_MODULES).map((adviceId): ReturnType<typeof it> =>
    it('returns a non-empty goal for advice ' + adviceId, (): void => {
      const goal = getAdviceGoal({adviceId}, t)
      expect(goal).to.not.be.empty
    }))
})

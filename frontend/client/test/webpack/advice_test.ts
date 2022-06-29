import {expect} from 'chai'
import type {TFunction} from 'i18next'
import i18n from 'i18next'
import {adviceModulesI18nFields, emailI18nFields, getAdviceGoal, getAdviceModule,
  getAdviceShortTitle, getAdviceTitle, getEmailTemplates} from 'store/advice'

import {ADVICE_MODULES} from 'components/advisor'


i18n.init({
  compatibilityJSON: 'v3',
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

describe('getAdviceModule', (): void => {
  before((): void => {
    getAdviceModule.cache.clear?.()
  })

  it('should return a proper module (check point)', (): void => {
    i18n.changeLanguage('fr')
    i18n.addResourceBundle('fr', 'adviceModules', {
      'fresh-resume:goal': 'bien refaire votre CV',
    })
    const t = i18n.getFixedT('fr', 'translation')
    const freshResumeModule = getAdviceModule('fresh-resume', t)
    expect(freshResumeModule).to.be.ok
    expect(freshResumeModule.goal).to.eq('bien refaire votre CV')
  })

  it('should return the right json format for another language than fr', (): void => {
    i18n.addResourceBundle('en', 'adviceModules', {
      'fresh-resume:goal': 'redo your resume properly',
    }, true)
    i18n.changeLanguage('en')
    const t = i18n.getFixedT('en', 'translation')
    const enModule = getAdviceModule('fresh-resume', t)
    expect(enModule).to.be.ok
    expect(enModule.goal).to.eq('redo your resume properly')
  })
})

function toCamelCase(snakeCase: string): string {
  return snakeCase.split('_').
    map((word, index) => index ? word.slice(0, 1).toUpperCase() + word.slice(1) : word).
    join('')
}

describe('adviceModulesI18nFields', (): void => {
  let translatableFields: readonly string[] = []
  before(async () => {
    const {default: airtableFields} = await import('../../airtable_fields.json5')
    translatableFields = (airtableFields.adviceModules.translatableFields || []).
      filter(field => !field.startsWith('title_')).
      map(toCamelCase)
  })

  it('should be in sync with translated values', () => {
    expect(adviceModulesI18nFields).to.eql(translatableFields)
  })
})

describe('emailI18nFields', (): void => {
  let translatableFields: readonly string[] = []
  before(async () => {
    const {default: airtableFields} = await import('../../airtable_fields.json5')
    translatableFields = (airtableFields.emailTemplates.translatableFields || []).map(toCamelCase)
  })

  it('should be in sync with translated values', () => {
    expect(emailI18nFields).to.eql(translatableFields)
  })
})


const emailTemplatesKeys = new Set([
  'content',
  'filters',
  'personalizations',
  'reason',
  'title',
  'type',
])


const isEmailTemplatesJson = (json: ReturnType<typeof getEmailTemplates>): void => {
  expect(json).to.be.an('object')
  for (const value of Object.values(json)) {
    expect(value).to.be.an('array')
    for (const template of value) {
      const unexpectedKeys =
        Object.keys(template).filter((key): boolean => !emailTemplatesKeys.has(key))
      expect(unexpectedKeys).to.be.empty
    }
  }
}


describe('getEmailTemplates', (): void => {
  // TODO(pascal): Consider dropping that test, it's covered by static typing already.
  it('should return the right json format', (): void => {
    i18n.changeLanguage('fr')
    i18n.addResourceBundle('fr', 'emailTemplates', {
      'recPzDMOZdVD0opz1:title': 'Demander un devis à une auto-école partenaire',
    })
    const t = i18n.getFixedT('fr', 'translation')
    isEmailTemplatesJson(getEmailTemplates(t))
  })

  it('should return the right json format for another language than fr', (): void => {
    i18n.addResourceBundle('en', 'emailTemplates', {
      'recPzDMOZdVD0opz1:title': 'Ask in English',
    }, true)
    i18n.changeLanguage('en')
    const t = i18n.getFixedT('en', 'translation')

    const enTemplates = getEmailTemplates(t)
    isEmailTemplatesJson(enTemplates)

    expect(enTemplates['driving-license-euro'][0].title).to.eq('Ask in English')
  })
})

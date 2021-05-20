import {expect} from 'chai'
import i18n from 'i18next'

import {getAdviceModule, getEmailTemplates, getLanguage, getLocaleWithTu,
  toLocaleString} from 'store/i18n'

i18n.init()

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


describe('getLanguage', (): void => {
  it("should return the language if it's simple enough.", (): void => {
    i18n.changeLanguage('en', (): void => {
      expect(getLanguage()).to.equal('en')
    })
  })

  it('should strip the language of its dialect, if there is one.', (): void => {
    i18n.changeLanguage('fr@tu', (): void => {
      expect(getLanguage()).to.equal('fr')
    })
  })
})

describe('toLocaleString', (): void => {
  it('should work on all supported languages', (): void => {
    for (const lang of (i18n.options?.supportedLngs || [])) {
      toLocaleString(2.1234, lang)
    }
  })
})

describe('getLocaleWithTu', (): void => {
  it('should strip the language of its dialect, if canTutoie is false.', (): void => {
    expect(getLocaleWithTu('fr@tu', false)).to.equal('fr')
    expect(getLocaleWithTu('fr', false)).to.equal('fr')
    expect(getLocaleWithTu('en@tu', false)).to.equal('en')
    expect(getLocaleWithTu('en', false)).to.equal('en')
  })

  it('should not touch a language without dialect', (): void => {
    expect(getLocaleWithTu('en', true)).to.equal('en')
  })

  it('should add tutoiement if language allows it and canTutoie is true.', (): void => {
    expect(getLocaleWithTu('fr', true)).to.equal('fr@tu')
  })
})

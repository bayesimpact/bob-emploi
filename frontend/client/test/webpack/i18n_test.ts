import {expect} from 'chai'
import i18n from 'i18next'

import {defaultInitOptions, getLanguage, getLocaleWithTu, toLocaleString,
  getFallbackLanguages} from 'store/i18n'
import {locales as dateLocales} from 'store/i18n_date'

i18n.init()


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

describe('supportedLngs', (): void => {
  it('should have a defined date locale for each supported language.', (): void => {
    expect(dateLocales).to.have.all.keys(defaultInitOptions.supportedLngs || [])
  })
})

describe('getFallbackLanguages', (): void => {
  it('should return simple lang as such', (): void => {
    expect(getFallbackLanguages('fr')).to.eql(['fr'])
    expect(getFallbackLanguages('en')).to.eql(['en'])
  })

  it('should fallback to lang without dialect if any', (): void => {
    expect(getFallbackLanguages('fr@tu')).to.eql(['fr@tu', 'fr'])
  })

  it('should fallback to lang without country if any', (): void => {
    expect(getFallbackLanguages('en_UK')).to.eql(['en_UK', 'en'])
  })
})

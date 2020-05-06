import {expect} from 'chai'
import i18n from 'i18next'

import {getLanguage, getLocaleWithTu} from 'store/i18n'

// TODO(cyrille): Use the init from main.tsx
i18n.init({
  whitelist: ['fr', 'fr@tu', 'en'],
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

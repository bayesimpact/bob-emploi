import {expect} from 'chai'
import i18n from 'i18next'

import {getLanguage} from 'store/i18n'

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

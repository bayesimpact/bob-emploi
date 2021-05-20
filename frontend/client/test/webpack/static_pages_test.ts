import {expect} from 'chai'

import {STATIC_ADVICE_MODULES} from 'components/pages/static/static_advice/base'

import {getPageDescription} from '../../release/lambdas/opengraph_redirect'


describe('Static advice page', (): void => {
  STATIC_ADVICE_MODULES.map(({adviceId}): void => {
    describe(`page ${adviceId}`, (): void => {
      it('should have a basic Open Graph description', (): void => {
        const {description, title} =
          getPageDescription(`conseil/${adviceId}`, config.productName, config.canonicalUrl)
        expect(description).to.be.a('string')
        expect(title).to.be.a('string')
      })
    })
  })
})

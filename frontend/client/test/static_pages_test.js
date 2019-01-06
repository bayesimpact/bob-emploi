import {expect} from 'chai'

import {STATIC_ADVICE_MODULES} from 'components/pages/static/static_advice/base'

import {getPageDescription} from '../release/opengraph_redirect'


describe('Static advice page', () => {
  STATIC_ADVICE_MODULES.map(({adviceId}) => {
    describe(`page ${adviceId}`, () => {
      it('should have a basic Open Graph description', () => {
        const {description, title} = getPageDescription(`conseil/${adviceId}`)
        expect(description).to.be.a('string')
        expect(title).to.be.a('string')
      })
    })
  })
})

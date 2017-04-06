var chai = require('chai')
var expect = chai.expect
import {PERSONALIZATION_IDS, getPersonalizations} from 'store/personalizations'


describe('getPersonnalizations', () => {
  it('should return personalizations objects', () => {
    const result = getPersonalizations(
      ['NO_OFFERS', 'ATYPIC_PROFILE', 'NO_OFFER_ANSWERS'],
      {frustrations: ['NO_OFFERS', 'ATYPIC_PROFILE', 'NO_OFFER_ANSWERS']},
      {})
    expect(result.length).to.equal(3)
    result.forEach(personalization => expect(personalization.youToldUs).not.to.be.undefined)
  })

  it('should return only the personalizations selected as input', () => {
    const result = getPersonalizations(
      ['NO_OFFERS', 'NO_OFFER_ANSWERS'],
      {frustrations: ['NO_OFFERS', 'ATYPIC_PROFILE', 'NO_OFFER_ANSWERS']},
      {})
    expect(result.length).to.equal(2)
  })

  it('should not crash if frustrations field is missing', () => {
    const result = getPersonalizations(['NO_OFFERS', 'NO_OFFER_ANSWERS'], {}, {})
    expect(result.length).to.equal(0)
  })

  it('should not return any personalization if no field is set', () => {
    const result = getPersonalizations(PERSONALIZATION_IDS, {}, {})
    expect(result).to.deep.equal([])
  })
})

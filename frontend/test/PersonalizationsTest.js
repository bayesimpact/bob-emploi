var chai = require('chai')
var expect = chai.expect
import {filterPersonalizations} from 'store/personalizations'


describe('filterPersonalizations', () => {
  it('should return personalizations objects', () => {
    const result = filterPersonalizations(
      [
        {filters: ['NO_OFFERS'], tip: 'first tip'},
        {filters: ['ATYPIC_PROFILE'], tip: 'second tip'},
        {filters: ['NO_OFFER_ANSWERS'], tip: 'third tip'},
      ],
      {frustrations: ['NO_OFFERS', 'ATYPIC_PROFILE', 'NO_OFFER_ANSWERS']},
      {})
    expect(result.length).to.equal(3)
    result.forEach(personalization => {
      expect(personalization.title).not.to.be.undefined
      expect(personalization.tip).not.to.be.undefined
    })
  })

  it('should return only the personalizations selected as input', () => {
    const result = filterPersonalizations(
      [{filters: ['NO_OFFERS'], tip: 'only tip'}],
      {frustrations: ['NO_OFFERS', 'ATYPIC_PROFILE', 'NO_OFFER_ANSWERS']},
      {})
    expect(result.length).to.equal(1)
  })

  it('should not crash if frustrations field is missing', () => {
    const result = filterPersonalizations(
      [{filters: ['NO_OFFERS'], tip: 'only tip'}],
      {}, {})
    expect(result.length).to.equal(0)
  })
})

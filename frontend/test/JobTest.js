const chai = require('chai')
const expect = chai.expect
import {genderizeJob} from 'store/job.js'
import {JobSuggest} from 'components/suggestions'

describe('jobFromSuggestion', () => {

  const {jobFromSuggestion} = new JobSuggest({})

  it('should assemble a job proto from a suggestion', () => {
    const job = jobFromSuggestion({
      codeOgr: '38972',
      codeRome: 'M1403',
      libelleAppellationCourt: 'Data Manager(euse)',
      libelleAppellationLong: 'Data Manager / Manageuse',
      libelleRome: 'Études et prospectives socio-économiques',
    })
    expect(job).to.deep.equal({
      codeOgr: '38972',
      jobGroup: {
        name: 'Études et prospectives socio-économiques',
        romeId: 'M1403',
      },
      name: 'Data Manager(euse)',
    })
  })
  it('should add genderize names when available', () => {
    const job = jobFromSuggestion({
      codeOgr: '38972',
      codeRome: 'M1403',
      libelleAppellationCourt: 'Data Manager(euse)',
      libelleAppellationCourtFeminin: 'Data Manageuse',
      libelleAppellationCourtMasculin: 'Data Manager',
      libelleAppellationLong: 'Data Manager / Manageuse',
      libelleRome: 'Études et prospectives socio-économiques',
    })
    expect(job).to.deep.equal({
      codeOgr: '38972',
      feminineName: 'Data Manageuse',
      jobGroup: {
        name: 'Études et prospectives socio-économiques',
        romeId: 'M1403',
      },
      masculineName: 'Data Manager',
      name: 'Data Manager(euse)',
    })
  })
})


describe('genderizeJob', () => {
  it('should return an empty string for an empty job', () => {
    const name = genderizeJob({}, 'FEMININE')
    expect('', name)
  })
  it('should return the feminine name if FEMININE gender', () => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'FEMININE')
    expect('feminineFoo', name)
  })
  it('should return the masculine name if MASCULINE gender', () => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'MASCULINE')
    expect('masculineFoo', name)
  })
  it('should return the default name if no gender', () => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, undefined)
    expect('foo', name)
  })
  it('should return the default name if unknown gender', () => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'WOMAN')
    expect('foo', name)
  })
  it('should return the default name if the genderized name is missing', () => {
    const name = genderizeJob({
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'FEMININE')
    expect('foo', name)
  })
})

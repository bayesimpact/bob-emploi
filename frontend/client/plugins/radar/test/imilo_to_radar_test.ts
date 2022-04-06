import {expect} from 'chai'
import _shuffle from 'lodash/shuffle'

import {getTypeformFields, makePoliciesString} from '../src/imilo_to_radar'

// TODO(cyrille): Add more tests.
describe('getTypeformFields', () => {
  it('should generate all fields for a fully configured dossier', () => {
    const thisYear = new Date().getFullYear()
    const typeformFields = getTypeformFields({
      fullReferent: {id: 54_321},
      fullSchoolLevel: {code: 'VB'},
      id: 99_999,
      identity: {birthDate: `18/05/${thisYear - 25}`},
      structure: 7709,
    }, {
      email: 'cyrille@bayes.org',
      id: 12_345,
    }, [{id: 510}], [
      {
        policy: {name: 'Garantie Jeunes'},
        status: 'RUNNING',
      }, {
        policy: {name: 'CEP'},
        status: 'RUNNING',
      }, {
        policy: {name: 'PACEA'},
        status: 'CLOSED',
      },
    ])
    expect(typeformFields.age).to.eq(25)
    expect(typeformFields['counselor_email']).to.eq('cyrille@bayes.org')
    expect(typeformFields['counselor_id']).to.eq(12_345)
    expect(typeformFields['current_policies']).to.eq('CEP,Garantie-Jeunes')
    expect(typeformFields['dossier_id']).to.eq(99_999)
    expect(typeformFields['referent_id']).to.eq(54_321)
    expect(typeformFields['school_level']).to.eq('VB')
    expect(typeformFields['structure_id']).to.eq(510)
  })
})

describe('makePoliciesString', () => {
  it('should generate an empty string for no policies', () => {
    const policiesString = makePoliciesString([])
    expect(policiesString).to.be.a('string')
    expect(policiesString).to.be.empty
  })

  it('should generate the policies in the same order', () => {
    const policies: readonly PolicyInfo[] = [
      {
        policy: {name: 'Garantie Jeunes'},
        status: 'RUNNING',
      }, {
        policy: {name: 'CEP'},
        status: 'RUNNING',
      }, {
        policy: {name: 'PACEA'},
        status: 'RUNNING',
      },
    ]
    const policiesString = makePoliciesString(policies)
    const unorderedPoliciesString = makePoliciesString(_shuffle(policies))
    expect(policiesString).to.eql(unorderedPoliciesString)
  })

  it('should filter out closed policies', () => {
    const policies: readonly PolicyInfo[] = [
      {
        policy: {name: 'Garantie Jeunes'},
        status: 'RUNNING',
      }, {
        policy: {name: 'CEP'},
        status: 'CLOSED',
      }, {
        policy: {name: 'PACEA'},
        status: 'CLOSED',
      },
    ]
    const policiesString = makePoliciesString(policies)
    expect(policiesString).to.eql('Garantie-Jeunes')
  })
})

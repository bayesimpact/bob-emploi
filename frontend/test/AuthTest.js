/* eslint-env mocha */
var chai = require('chai')
var expect = chai.expect
import {splitFullName} from 'store/auth'

describe('split the name into a first and last name', () => {
  it('should return empty values for an empty input', () => {
    expect(splitFullName(null)).to.deep.equal({lastName: '', name: ''})
    expect(splitFullName('')).to.deep.equal({lastName: '', name: ''})
  })

  it('should only set the first name when nothing to split', () => {
    expect(splitFullName('Onename')).to.deep.equal({lastName: '', name: 'Onename'})
  })

  it('should set the first name and last name on one space', () => {
    expect(splitFullName('Firstname Lastname')).to.deep.equal({
      lastName: 'Lastname',
      name: 'Firstname',
    })
  })

  it('should ignore middle names', () => {
    expect(splitFullName('Firstname Middlename Lastname')).to.deep.equal({
      lastName: 'Lastname',
      name: 'Firstname',
    })
  })
})

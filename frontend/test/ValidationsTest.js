const chai = require('chai')
const expect = chai.expect
import {validateEmail, dateInPast} from 'store/validations.js'

describe('validateEmail', () => {
  it('should return true for a valid email', () => {
    const res = validateEmail('stephan@bayesimpact.org')
    expect(res).to.equal(true)
  })

  it('should return true for an email containing a dot', () => {
    const res = validateEmail('stephan.gabler@bayesimpact.org')
    expect(res).to.equal(true)
  })

  it('should return false for an invalid email', () => {
    const res = validateEmail('stephan.ist.cool')
    expect(res).to.equal(false)
  })

  it('should return false for if a valid email is suffixed with a blank space', () => {
    const res = validateEmail('stephan@bayesimpact.org ')
    expect(res).to.equal(false)
  })
})

describe('dateInPast', () => {
  it('should return true for a date lying in the past', () => {
    const res = dateInPast(2011, 1)
    expect(res).to.equal(true)
  })

  it('should return true for a date lying in the past even in January', () => {
    const res = dateInPast(2011, 0)
    expect(res).to.equal(true)
  })

  it('should return false if the month is undefined', () => {
    const res = dateInPast(2011, undefined)
    expect(res).to.equal(false)
  })

  it('should return false for a date lying in the future', () => {
    const res = dateInPast(2020, 1)
    expect(res).to.equal(false)
  })
})

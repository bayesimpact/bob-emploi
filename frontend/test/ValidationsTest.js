const chai = require('chai')
const expect = chai.expect
import {validateEmail} from 'store/validations.js'

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

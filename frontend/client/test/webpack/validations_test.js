import {expect} from 'chai'
import {validateEmail, validateObjectId} from 'store/validations'

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

  it('should return false for a valid email suffixed with a blank space', () => {
    const res = validateEmail('stephan@bayesimpact.org ')
    expect(res).to.equal(false)
  })
})

describe('validateObjectId', () => {
  it('should return true for a valid ObjectId', () => {
    const res = validateObjectId('e9d58eb646883a7d5bc9089a')
    expect(res).to.equal(true)
  })

  it('should return false for a short ObjectId', () => {
    const res = validateObjectId('e9d58eb646883a7d5bc9')
    expect(res).to.equal(false)
  })

  it('should return false for a short ObjectId', () => {
    const res = validateObjectId('e9d58eb646883a7d5bc9089a123ad12')
    expect(res).to.equal(false)
  })

  it('should return false for an uppercase ObjectId', () => {
    const res = validateObjectId('E9D58EB646883A7D5BC9089A')
    expect(res).to.equal(false)
  })

  it('should return false for a string with other elements than an ObjectId', () => {
    const res = validateObjectId('ObjectId("e9d58eb646883a7d5bc9089a")')
    expect(res).to.equal(false)
  })

})

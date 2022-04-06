import {expect} from 'chai'
import {scorePasswordComplexity, validateEmail, validateObjectId} from 'store/validations'

describe('validateEmail', (): void => {
  it('should return true for a valid email', (): void => {
    const res = validateEmail('stephan@bayesimpact.org')
    expect(res).to.equal(true)
  })

  it('should return true for an email containing a dot', (): void => {
    const res = validateEmail('stephan.gabler@bayesimpact.org')
    expect(res).to.equal(true)
  })

  it('should return false for an invalid email', (): void => {
    const res = validateEmail('stephan.ist.cool')
    expect(res).to.equal(false)
  })

  it('should return false for a valid email suffixed with a blank space', (): void => {
    const res = validateEmail('stephan@bayesimpact.org ')
    expect(res).to.equal(false)
  })
})

describe('validateObjectId', (): void => {
  it('should return true for a valid ObjectId', (): void => {
    const res = validateObjectId('e9d58eb646883a7d5bc9089a')
    expect(res).to.equal(true)
  })

  it('should return false for a short ObjectId', (): void => {
    const res = validateObjectId('e9d58eb646883a7d5bc9')
    expect(res).to.equal(false)
  })

  it('should return false for a long ObjectId', (): void => {
    const res = validateObjectId('e9d58eb646883a7d5bc9089a123ad12')
    expect(res).to.equal(false)
  })

  it('should return false for an uppercase ObjectId', (): void => {
    const res = validateObjectId('E9D58EB646883A7D5BC9089A')
    expect(res).to.equal(false)
  })

  it('should return false for a string with other elements than an ObjectId', (): void => {
    const res = validateObjectId('ObjectId("e9d58eb646883a7d5bc9089a")')
    expect(res).to.equal(false)
  })
})

describe('scorePasswordComplexity', (): void => {
  it('should not fail on an empty string', (): void => {
    const {isStrongEnough, score} = scorePasswordComplexity('')
    expect(score).to.equal(0)
    expect(isStrongEnough).to.equal(false)
  })

  it('should have a low score for a simple pin code', (): void => {
    const {isStrongEnough, score} = scorePasswordComplexity('2022')
    expect(score).to.be.within(1, 20)
    expect(isStrongEnough).to.equal(false)
  })

  it('should have a medium score for a short password depsite using complexity', (): void => {
    const {isStrongEnough, score} = scorePasswordComplexity('aA;3')
    expect(score).to.be.within(5, 40)
    expect(isStrongEnough).to.equal(false)
  })

  it('should have a medium score for "password"', (): void => {
    const {isStrongEnough, score} = scorePasswordComplexity('password')
    expect(score).to.be.within(30, 50)
    expect(isStrongEnough).to.equal(false)
  })

  it('should have a high score for a complex password', (): void => {
    const {isStrongEnough, score} = scorePasswordComplexity('qvWvJxcAW7yzn32')
    expect(score).to.be.above(80)
    expect(isStrongEnough).to.equal(true)
  })
})

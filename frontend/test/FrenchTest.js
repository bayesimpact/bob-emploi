const chai = require('chai')
const expect = chai.expect
import {lowerFirstLetter, maybeContract, maybeContractPrefix,
        readableDay} from 'store/french'


describe('readableDay', () => {
  const day = readableDay(new Date(2016, 10, 24))
  expect(day).to.equal('jeudi 24 novembre 2016')
})


describe('maybeContract', () => {
  it('should not contract if the next word starts with a consonant', () => {
    const word = maybeContract('foo', 'contracted foo', 'start with an S')
    expect(word).to.equal('foo')
  })

  it('should contract if the next word starts with a vowel', () => {
    const word = maybeContract('foo', 'contracted foo', 'a start with an A')
    expect(word).to.equal('contracted foo')
  })

  it('should contract if the next word starts with an accented vowel', () => {
    const word = maybeContract('foo', 'contracted foo', 'à start with an A with an accent')
    expect(word).to.equal('contracted foo')
  })

  it('should contract if the next word starts with an h', () => {
    const word = maybeContract('foo', 'contracted foo', 'h start with an H')
    expect(word).to.equal('contracted foo')
  })

  it('should contract if the next word starts with an upper case vowel', () => {
    const word = maybeContract('foo', 'contracted foo', 'A start with an upper case a')
    expect(word).to.equal('contracted foo')
  })

  it('should not contract if the next word is empty', () => {
    const word = maybeContract('foo', 'contracted foo', '')
    expect(word).to.equal('foo')
  })

  it('should not contract if the next word is missing', () => {
    const word = maybeContract('foo', 'contracted foo')
    expect(word).to.equal('foo')
  })
})


describe('maybeContractPrefix', () => {
  it('should not contract if the next word starts with a consonant', () => {
    const sentence = maybeContractPrefix('foo', 'contracted foo', 'start with an S')
    expect(sentence).to.equal('foostart with an S')
  })

  it('should contract if the next word starts with a vowel', () => {
    const sentence = maybeContractPrefix('foo', 'contracted foo', 'a start with an A')
    expect(sentence).to.equal('contracted fooa start with an A')
  })
})


describe('lowerFirstLetter', () => {
  it('should lower the first letter', () => {
    const word = lowerFirstLetter('This starts with an uppercase')
    expect('this starts with an uppercase', word)
  })

  it('should lower the letter if there is only one', () => {
    const word = lowerFirstLetter('T')
    expect('t', word)
  })

  it('should not do anything for an empty string', () => {
    const word = lowerFirstLetter('')
    expect('', word)
  })
})

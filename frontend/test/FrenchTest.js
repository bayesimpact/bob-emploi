import {expect} from 'chai'
import {lowerFirstLetter, ofCityPrefix, maybeContract, maybeContractPrefix,
  toTitleCase} from 'store/french'


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


describe('ofCityPrefix', () => {
  it('should add a simple "de" prefix for regular city names', () => {
    expect(ofCityPrefix('Toulouse')).to.eql({cityName: 'Toulouse', prefix: 'de '})
  })

  it('should use the "du" contraction when needed', () => {
    expect(ofCityPrefix('Le Mans')).to.eql({cityName: 'Mans', prefix: 'du '})
  })

  it('should lowercase "La" as a first word', () => {
    expect(ofCityPrefix('La Ferté')).to.eql({cityName: 'Ferté', prefix: 'de la '})
    expect(ofCityPrefix('Laval')).to.eql({cityName: 'Laval', prefix: 'de '})
  })

  it('should use the "des" contraction when needed', () => {
    expect(ofCityPrefix('Les Ulis')).to.eql({cityName: 'Ulis', prefix: 'des '})
  })

  it('should lowercase "L\'" as a first word', () => {
    expect(ofCityPrefix("L'Arbresle")).to.eql({cityName: 'Arbresle', prefix: "de l'"})
  })
})


describe('toTitleCase', () => {
  it('should capitalize simple words', () => {
    expect(toTitleCase('CARREFOUR')).to.eq('Carrefour')
  })

  it('should capitalize the first word ', () => {
    expect(toTitleCase('LES DELICES')).to.eq('Les Delices')
  })

  it('should capitalize all words', () => {
    expect(toTitleCase('assurance TOUT RISQUES')).to.eq('Assurance Tout Risques')
  })

  it('should capitalize after dashes', () => {
    expect(toTitleCase('THEOREME SHWARTZ-KOPZ-BIDULE')).to.eq('Theoreme Shwartz-Kopz-Bidule')
  })

  it('should capitalize lowercase words', () => {
    expect(toTitleCase('carrefour')).to.eq('Carrefour')
  })

  it('should keep some keywords intact', () => {
    expect(toTitleCase('SARL BOULANGERIE PATISSERIE GRANDE')).
      to.eq('SARL Boulangerie Patisserie Grande')
  })
})

import {expect} from 'chai'
import forEach from 'lodash/forEach'
import {lowerFirstLetter, ofPrefix, maybeContract, maybeContractPrefix,
  toTitleCase, getEvents, getAdviceModules, getEmailTemplates} from 'store/french'


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


describe('ofPrefix', () => {
  it('should add a simple "de" prefix for regular names', () => {
    expect(ofPrefix('Toulouse')).to.eql({modifiedName: 'Toulouse', prefix: 'de '})
  })

  it('should use the "du" contraction when needed', () => {
    expect(ofPrefix('Le Mans')).to.eql({modifiedName: 'Mans', prefix: 'du '})
  })

  it('should lowercase "La" as a first word', () => {
    expect(ofPrefix('La Ferté')).to.eql({modifiedName: 'Ferté', prefix: 'de la '})
    expect(ofPrefix('Laval')).to.eql({modifiedName: 'Laval', prefix: 'de '})
  })

  it('should use the "des" contraction when needed', () => {
    expect(ofPrefix('Les Ulis')).to.eql({modifiedName: 'Ulis', prefix: 'des '})
  })

  it('should lowercase "L\'" as a first word', () => {
    expect(ofPrefix("L'Arbresle")).to.eql({modifiedName: 'Arbresle', prefix: "de l'"})
  })

  it('should contract on capital vowel', () => {
    expect(ofPrefix('Arles')).to.eql({modifiedName: 'Arles', prefix: "d'"})
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


const userYouFromBool = canTutoie => (tu, vous) => canTutoie ? tu : vous
const isEventJson = json => {
  expect(json).to.be.an('object')
  expect(Object.keys(json).every(key => key.length === 1)).to.be.true
  Object.keys(json).forEach(key =>
    expect(json[key]).to.include.all.keys('atNext', 'eventLocation')
  )
}


describe('getEvents', () => {
  it(
    'should return the right json format for tutoiement',
    () => isEventJson(getEvents(userYouFromBool(true))),
  )

  it(
    'should return the right json format for vouvoiement',
    () => isEventJson(getEvents(userYouFromBool(false))),
  )

  // TODO(cyrille): Check they are different once they really are.
})


const adviceModuleKeys = new Set([
  'callToAction',
  'explanations',
  'goal',
  'title',
  'titleXStars',
  'userGainCallout',
  'userGainDetails',
])

const isAdviceModuleJson = json => {
  expect(json).to.be.an('object')
  forEach(json, value => {
    const unexpectedKeys = Object.keys(value).filter(key => !adviceModuleKeys.has(key))
    expect(unexpectedKeys).to.be.empty
  })
}


describe('getAdviceModules', () => {
  it('should return the right json format for tutoiement',
    () => isAdviceModuleJson(getAdviceModules(userYouFromBool(true))))

  it('should return the right json format for vouvoiement',
    () => isAdviceModuleJson(getAdviceModules(userYouFromBool(false))))
})


const emailTemplatesKeys = new Set([
  'content',
  'filters',
  'personalizations',
  'reason',
  'title',
  'type',
])


const isEmailTemplatesJson = json => {
  expect(json).to.be.an('object')
  forEach(json, value => {
    expect(value).to.be.an('array')
    value.forEach(template => {
      const unexpectedKeys =
        Object.keys(template).filter(key => !emailTemplatesKeys.has(key))
      expect(unexpectedKeys).to.be.empty
    })
  })
}


describe('getEmailTemplates', () => {
  it('should return the right json format for tutoiement',
    () => isEmailTemplatesJson(getEmailTemplates(userYouFromBool(true))))

  it('should return the right json format for vouvoiement',
    () => isEmailTemplatesJson(getEmailTemplates(userYouFromBool(false))))
})

import {expect} from 'chai'
import {YouChooser, lowerFirstLetter, ofPrefix, maybeContract, maybeContractPrefix, getDateString,
  toTitleCase, getEvents, getAdviceModules, getEmailTemplates, slugify, getMonthName,
  getDiffBetweenDatesInString} from 'store/french'

// @ts-ignore
import {Month} from 'api/job'

describe('maybeContract', (): void => {
  it('should not contract if the next word starts with a consonant', (): void => {
    const word = maybeContract('foo', 'contracted foo', 'start with an S')
    expect(word).to.equal('foo')
  })

  it('should contract if the next word starts with a vowel', (): void => {
    const word = maybeContract('foo', 'contracted foo', 'a start with an A')
    expect(word).to.equal('contracted foo')
  })

  it('should contract if the next word starts with an accented vowel', (): void => {
    const word = maybeContract('foo', 'contracted foo', 'à start with an A with an accent')
    expect(word).to.equal('contracted foo')
  })

  it('should contract if the next word starts with an h', (): void => {
    const word = maybeContract('foo', 'contracted foo', 'h start with an H')
    expect(word).to.equal('contracted foo')
  })

  it('should contract if the next word starts with an upper case vowel', (): void => {
    const word = maybeContract('foo', 'contracted foo', 'A start with an upper case a')
    expect(word).to.equal('contracted foo')
  })

  it('should not contract if the next word is empty', (): void => {
    const word = maybeContract('foo', 'contracted foo', '')
    expect(word).to.equal('foo')
  })
})


describe('maybeContractPrefix', (): void => {
  it('should not contract if the next word starts with a consonant', (): void => {
    const sentence = maybeContractPrefix('foo', 'contracted foo', 'start with an S')
    expect(sentence).to.equal('foostart with an S')
  })

  it('should contract if the next word starts with a vowel', (): void => {
    const sentence = maybeContractPrefix('foo', 'contracted foo', 'a start with an A')
    expect(sentence).to.equal('contracted fooa start with an A')
  })
})


describe('lowerFirstLetter', (): void => {
  it('should lower the first letter', (): void => {
    const word = lowerFirstLetter('This starts with an uppercase')
    expect(word).to.equal('this starts with an uppercase')
  })

  it('should lower the letter if there is only one', (): void => {
    const word = lowerFirstLetter('T')
    expect(word).to.equal('t')
  })

  it('should not do anything for an empty string', (): void => {
    const word = lowerFirstLetter('')
    expect(word).to.equal('')
  })

  it('should not lower the first letter of an acronym', (): void => {
    const word = lowerFirstLetter('SPA manager')
    expect(word).to.equal('SPA manager')
  })
})


describe('ofPrefix', (): void => {
  it('should add a simple "de" prefix for regular names', (): void => {
    expect(ofPrefix('Toulouse')).to.eql({modifiedName: 'Toulouse', prefix: 'de '})
  })

  it('should use the "du" contraction when needed', (): void => {
    expect(ofPrefix('Le Mans')).to.eql({modifiedName: 'Mans', prefix: 'du '})
  })

  it('should lowercase "La" as a first word', (): void => {
    expect(ofPrefix('La Ferté')).to.eql({modifiedName: 'Ferté', prefix: 'de la '})
    expect(ofPrefix('Laval')).to.eql({modifiedName: 'Laval', prefix: 'de '})
  })

  it('should use the "des" contraction when needed', (): void => {
    expect(ofPrefix('Les Ulis')).to.eql({modifiedName: 'Ulis', prefix: 'des '})
  })

  it('should lowercase "L\'" as a first word', (): void => {
    expect(ofPrefix("L'Arbresle")).to.eql({modifiedName: 'Arbresle', prefix: "de l'"})
  })

  it('should contract on capital vowel', (): void => {
    expect(ofPrefix('Arles')).to.eql({modifiedName: 'Arles', prefix: "d'"})
  })
})


describe('toTitleCase', (): void => {
  it('should capitalize simple words', (): void => {
    expect(toTitleCase('CARREFOUR')).to.eq('Carrefour')
  })

  it('should capitalize the first word ', (): void => {
    expect(toTitleCase('LES DELICES')).to.eq('Les Delices')
  })

  it('should capitalize all words', (): void => {
    expect(toTitleCase('assurance TOUT RISQUES')).to.eq('Assurance Tout Risques')
  })

  it('should capitalize after dashes', (): void => {
    expect(toTitleCase('THEOREME SHWARTZ-KOPZ-BIDULE')).to.eq('Theoreme Shwartz-Kopz-Bidule')
  })

  it('should capitalize lowercase words', (): void => {
    expect(toTitleCase('carrefour')).to.eq('Carrefour')
  })

  it('should keep some keywords intact', (): void => {
    expect(toTitleCase('SARL BOULANGERIE PATISSERIE GRANDE')).
      to.eq('SARL Boulangerie Patisserie Grande')
  })

  it('should work with an empty string', (): void => {
    expect(toTitleCase('')).to.eq('')
  })
})


const userYouFromBool = (canTutoie): YouChooser => {
  return function <T>(tu: T, vous: T): T {
    return canTutoie ? tu : vous
  }
}
const isEventJson = (json): void => {
  expect(json).to.be.an('object')
  expect(Object.keys(json).every((key): boolean => key.length === 1)).to.be.true
  Object.keys(json).forEach((key): void =>
    expect(json[key]).to.include.all.keys('atNext', 'eventLocation')
  )
}


describe('getEvents', (): void => {
  it(
    'should return the right json format for tutoiement',
    (): void => isEventJson(getEvents(userYouFromBool(true))),
  )

  it(
    'should return the right json format for vouvoiement',
    (): void => isEventJson(getEvents(userYouFromBool(false))),
  )

  // TODO(cyrille): Check they are different once they really are.
})


const adviceModuleKeys = new Set([
  'callToAction',
  'explanations',
  'goal',
  'shortTitle',
  'title',
  'titleXStars',
  'userGainCallout',
  'userGainDetails',
])

const isAdviceModuleJson = (json): void => {
  expect(json).to.be.an('object')
  Object.keys(json).forEach((adviceId): void => {
    const unexpectedKeys = Object.keys(json[adviceId]).
      filter((key): boolean => !adviceModuleKeys.has(key))
    expect(unexpectedKeys).to.be.empty
  })
}


describe('getAdviceModules', (): void => {
  it('should return the right json format for tutoiement',
    (): void => isAdviceModuleJson(getAdviceModules(userYouFromBool(true))))

  it('should return the right json format for vouvoiement',
    (): void => isAdviceModuleJson(getAdviceModules(userYouFromBool(false))))
})


const emailTemplatesKeys = new Set([
  'content',
  'filters',
  'personalizations',
  'reason',
  'title',
  'type',
])


const isEmailTemplatesJson = (json): void => {
  expect(json).to.be.an('object')
  Object.keys(json).forEach((adviceId): void => {
    const value = json[adviceId]
    expect(value).to.be.an('array')
    value.forEach((template): void => {
      const unexpectedKeys =
        Object.keys(template).filter((key): boolean => !emailTemplatesKeys.has(key))
      expect(unexpectedKeys).to.be.empty
    })
  })
}


describe('getEmailTemplates', (): void => {
  it('should return the right json format for tutoiement',
    (): void => isEmailTemplatesJson(getEmailTemplates(userYouFromBool(true))))

  it('should return the right json format for vouvoiement',
    (): void => isEmailTemplatesJson(getEmailTemplates(userYouFromBool(false))))
})


describe('getDateString', (): void => {
  it('should get a readable date from a timestamp', (): void => {
    expect(getDateString(1539154358756)).to.eq('10 oct. 2018')
  })

  it('should accept a JSON ISO string as an input', (): void => {
    expect(getDateString('2018-03-25T14:25:34Z')).to.eq('25 mars 2018')
  })

  it('should not print leading 0 in front of day in month', (): void => {
    expect(getDateString('2018-03-05T14:25:34Z')).to.eq('5 mars 2018')
  })
})


describe('getDateFromNowInString', (): void => {
  it('should return today when the two dates are the same', (): void => {
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/29/2019'))).to.eq("aujourd'hui")
  })

  it('should return the difference in months when the difference is greater than 30 days',
    (): void => {
      expect(getDiffBetweenDatesInString(
        new Date('1/29/2019'), new Date('6/29/2019'))).to.eq('il y a 5 mois')
    })

  it('should return the difference in weeks when the difference is less than 30 days', (): void => {
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/21/2019'))).to.eq('il y a 1 semaine')
  })

  it('should return the difference in days when the difference is less than 7 days', (): void => {
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/28/2019'))).to.eq('il y a 1 jour')
  })

  it('should return the plural form when there is a several days difference', (): void => {
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/26/2019'))).to.eq('il y a 3 jours')
  })
})


describe('slugify', (): void => {
  it('should return only lower case', (): void =>
    expect(slugify('ABCDEfghIJK')).to.eq('abcdefghijk'))

  it('should replace spaces with dashes', (): void =>
    expect(slugify('le petit chaperon rouge')).to.eq('le-petit-chaperon-rouge'))

  it('should replace accented characters with non accented version', (): void =>
    expect(slugify('àêrïen')).to.eq('aerien'))
})


describe('getMonthName', (): void => Object.keys(Month).forEach((month: bayes.bob.Month): void => {
  Month[month] && it(`should return a non-empty string for ${month}`, (): void =>
    expect(getMonthName(month)).to.not.be.empty)
}))


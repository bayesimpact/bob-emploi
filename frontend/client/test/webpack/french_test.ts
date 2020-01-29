import {expect} from 'chai'
import i18n from 'i18next'
import {lowerFirstLetter, ofPrefix, maybeContract, maybeContractPrefix, getDateString,
  toTitleCase, getAdviceModule, getEmailTemplates, slugify, getMonthName,
  getDiffBetweenDatesInString} from 'store/french'

// @ts-ignore
import {Month} from 'api/job'


i18n.init({lng: 'fr', resources: {}})


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
  before((): void => {
    i18n.changeLanguage('fr')
    i18n.addResourceBundle('fr', 'translation', {})
  })

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

  it('should contract the prefix when used with the French language', (): void => {
    const t = i18n.getFixedT('fr', 'translation')
    expect(ofPrefix('Les Ulis', t)).to.eql({modifiedName: 'Ulis', prefix: 'des '})
  })

  it('should not contract the prefix when used with the English language', (): void => {
    i18n.changeLanguage('en')
    i18n.addResourceBundle('en', 'translation', {'de {{fullName}}': 'of {{fullName}}'})
    const t = i18n.getFixedT('en', 'other')
    expect(ofPrefix('Les Ulis', t)).to.eql({modifiedName: 'Les Ulis', prefix: 'of '})
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


describe('getAdviceModule', (): void => {
  it('should return a proper module (check point)', (): void => {
    i18n.changeLanguage('fr')
    i18n.addResourceBundle('fr', 'adviceModules', {})
    const t = i18n.getFixedT('fr', 'translation')
    const freshResumeModule = getAdviceModule('fresh-resume', t)
    expect(freshResumeModule).to.be.ok
    expect(freshResumeModule.goal).to.eq('bien refaire votre CV')
  })

  it('should return the right json format for another language than fr', (): void => {
    i18n.addResourceBundle('en', 'adviceModules', {
      'bien refaire votre CV': 'redo your resume properly',
    }, true)
    i18n.changeLanguage('en')
    const t = i18n.getFixedT('en', 'translation')
    const enModule = getAdviceModule('fresh-resume', t)
    expect(enModule).to.be.ok
    expect(enModule.goal).to.eq('redo your resume properly')
  })
})


const emailTemplatesKeys = new Set([
  'content',
  'filters',
  'personalizations',
  'reason',
  'title',
  'type',
])


const isEmailTemplatesJson = (json: ReturnType<typeof getEmailTemplates>): void => {
  expect(json).to.be.an('object')
  Object.keys(json).forEach((adviceId: string): void => {
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
  // TODO(pascal): Consider dropping that test, it's covered by static typing already.
  it('should return the right json format', (): void => {
    i18n.changeLanguage('fr')
    i18n.addResourceBundle('fr', 'emailTemplates', {})
    const t = i18n.getFixedT('fr', 'translation')
    isEmailTemplatesJson(getEmailTemplates(t))
  })

  it('should return the right json format for another language than fr', (): void => {
    i18n.addResourceBundle('en', 'emailTemplates', {
      'Demander un devis à une auto-école partenaire': 'Ask in English',
    }, true)
    i18n.changeLanguage('en')
    const t = i18n.getFixedT('en', 'translation')

    const enTemplates = getEmailTemplates(t)
    isEmailTemplatesJson(enTemplates)

    expect(enTemplates['driving-license-euro'][0].title).to.eq('Ask in English')
  })
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
  it('should return only lower case', (): void => {
    expect(slugify('ABCDEfghIJK')).to.eq('abcdefghijk')
  })

  it('should replace spaces with dashes', (): void => {
    expect(slugify('le petit chaperon rouge')).to.eq('le-petit-chaperon-rouge')
  })

  it('should replace accented characters with non accented version', (): void => {
    expect(slugify('àêrïen')).to.eq('aerien')
  })
})


describe('getMonthName', (): void => (Object.keys(Month) as readonly bayes.bob.Month[]).
  forEach((month: bayes.bob.Month): void => {
    Month[month] && it(`should return a non-empty string for ${month}`, (): void => {
      expect(getMonthName(month)).to.not.be.empty
    })
  }))

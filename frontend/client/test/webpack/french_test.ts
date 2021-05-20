import {expect} from 'chai'
import i18n from 'i18next'
import {lowerFirstLetter, ofPrefix, maybeContract, maybeContractPrefix, getDateString,
  toTitleCase, slugify, getMonthName,
  getDiffBetweenDatesInString, closeToCity, ofJobName} from 'store/french'

// @ts-ignore
import {Month} from 'api/job'


i18n.init({
  keySeparator: false,
  lng: 'fr',
  nsSeparator: false,
  resources: {},
})


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

  const t = i18n.getFixedT('fr', 'translation')

  it('should add a simple "de" prefix for regular names', (): void => {
    expect(ofPrefix('Toulouse', t)).to.eql({modifiedName: 'Toulouse', prefix: 'de '})
  })

  it('should use the "du" contraction when needed', (): void => {
    expect(ofPrefix('Le Mans', t)).to.eql({modifiedName: 'Mans', prefix: 'du '})
  })

  it('should lowercase "La" as a first word', (): void => {
    expect(ofPrefix('La Ferté', t)).to.eql({modifiedName: 'Ferté', prefix: 'de la '})
    expect(ofPrefix('Laval', t)).to.eql({modifiedName: 'Laval', prefix: 'de '})
  })

  it('should use the "des" contraction when needed', (): void => {
    expect(ofPrefix('Les Ulis', t)).to.eql({modifiedName: 'Ulis', prefix: 'des '})
  })

  it('should lowercase "L\'" as a first word', (): void => {
    expect(ofPrefix("L'Arbresle", t)).to.eql({modifiedName: 'Arbresle', prefix: "de l'"})
  })

  it('should contract on capital vowel', (): void => {
    expect(ofPrefix('Arles', t)).to.eql({modifiedName: 'Arles', prefix: "d'"})
  })

  it('should contract the prefix when used with the French language', (): void => {
    expect(ofPrefix('Les Ulis', t)).to.eql({modifiedName: 'Ulis', prefix: 'des '})
  })

  it('should not contract the prefix when used with the English language', (): void => {
    i18n.changeLanguage('en')
    i18n.addResourceBundle('en', 'translation', {'de {{fullName}}': 'of {{fullName}}'})
    const englishT = i18n.getFixedT('en', 'other')
    expect(ofPrefix('Les Ulis', englishT)).to.eql({modifiedName: 'Les Ulis', prefix: 'of '})
  })
})


describe('closeToCity', (): void => {
  before((): void => {
    i18n.changeLanguage('fr')
    i18n.addResourceBundle('fr', 'translation', {})
  })

  it('should simply prefix "près de" for simple cases', (): void => {
    const t = i18n.getFixedT('fr', 'other')
    expect(closeToCity('Toulouse', t)).to.eql('près de Toulouse')
  })

  it('should take into account city prefixes', (): void => {
    const t = i18n.getFixedT('fr', 'other')
    expect(closeToCity('La Ferté', t)).to.eql('près de la Ferté')
    expect(closeToCity('Le Mans', t)).to.eql('près du Mans')
    expect(closeToCity('Les Ulis', t)).to.eql('près des Ulis')
    expect(closeToCity("L'Arbresle", t)).to.eql("près de l'Arbresle")
    expect(closeToCity('Arles', t)).to.eql("près d'Arles")
  })

  it('should not change prefixes when using another language', (): void => {
    i18n.changeLanguage('en')
    i18n.addResourceBundle('en', 'translation', {'près de {{cityName}}': 'close to {{cityName}}'})
    const t = i18n.getFixedT('en', 'other')
    expect(closeToCity('Toulouse', t)).to.eql('close to Toulouse')
    expect(closeToCity('Le Mans', t)).to.eql('close to Le Mans')
  })
})


describe('ofJobName', (): void => {
  before((): void => {
    i18n.changeLanguage('fr')
    i18n.addResourceBundle('fr', 'translation', {})
  })

  it('should simply prefix "de " for simple cases', (): void => {
    const t = i18n.getFixedT('fr', 'other')
    expect(ofJobName('restaurateur', t)).to.eql('de restaurateur')
  })

  it('should contract the prefix if needed', (): void => {
    const t = i18n.getFixedT('fr', 'other')
    expect(ofJobName('ingénieur', t)).to.eql("d'ingénieur")
    expect(ofJobName('hôtelier', t)).to.eql("d'hôtelier")
  })

  it('should not change prefixes when using another language', (): void => {
    i18n.changeLanguage('en')
    i18n.addResourceBundle('en', 'translation', {'de {{jobName}}': 'of {{jobName}}'})
    const t = i18n.getFixedT('en', 'other')
    expect(ofJobName('restaurateur', t)).to.eql('of restaurateur')
    expect(ofJobName('ingénieur', t)).to.eql('of ingénieur')
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


describe('getDateString', (): void => {
  before((): void => {
    i18n.changeLanguage('fr')
  })

  it('should get a readable date from a timestamp', (): void => {
    const t = i18n.getFixedT('fr', 'translation')
    expect(getDateString(1_539_154_358_756, t)).to.eq('10 oct. 2018')
  })

  it('should accept a JSON ISO string as an input', (): void => {
    const t = i18n.getFixedT('fr', 'translation')
    expect(getDateString('2018-03-25T14:25:34Z', t)).to.eq('25 mars 2018')
  })

  it('should not print leading 0 in front of day in month', (): void => {
    const t = i18n.getFixedT('fr', 'translation')
    expect(getDateString('2018-03-05T14:25:34Z', t)).to.eq('5 mars 2018')
  })

  it('should print the date in English', (): void => {
    i18n.addResourceBundle('en', 'translation', {
      'fr': 'en',
      'janv./févr./mars/avr./mai/juin/juil./août/sept./oct./nov./déc.':
      'Jan./Feb./Mar./Apr./May/June/July/Aug./Sept./Oct./Nov./Dec.',
    })
    i18n.changeLanguage('en')
    const t = i18n.getFixedT('en', 'translation')
    expect(getDateString('2018-08-05T14:25:34Z', t)).to.eq('5 Aug. 2018')
  })
})


describe('getDateFromNowInString', (): void => {
  before((): void => {
    i18n.changeLanguage('fr')
    // eslint-disable-next-line camelcase
    i18n.addResourceBundle('fr', 'translation', {jour_plural: 'jours'})
  })

  it('should return today when the two dates are the same', (): void => {
    const t = i18n.getFixedT('fr', 'translation')
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/29/2019'), t)).to.eq("aujourd'hui")
  })

  it('should return the difference in months when the difference is greater than 30 days',
    (): void => {
      const t = i18n.getFixedT('fr', 'translation')
      expect(getDiffBetweenDatesInString(
        new Date('1/29/2019'), new Date('6/29/2019'), t)).to.eq('il y a 5 mois')
    })

  it('should return the difference in weeks when the difference is less than 30 days', (): void => {
    const t = i18n.getFixedT('fr', 'translation')
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/21/2019'), t)).to.eq('il y a 1 semaine')
  })

  it('should return the difference in days when the difference is less than 7 days', (): void => {
    const t = i18n.getFixedT('fr', 'translation')
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/28/2019'), t)).to.eq('il y a 1 jour')
  })

  it('should return the plural form when there is a several days difference', (): void => {
    const t = i18n.getFixedT('fr', 'translation')
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/26/2019'), t)).to.eq('il y a 3 jours')
  })

  it('should work in English as well', (): void => {
    i18n.addResourceBundle('en', 'translation', {
      'il y a {{numUnits}} {{unit}}': '{{numUnits}} {{unit}} ago',
      'jour_plural': 'days',
    })
    const t = i18n.getFixedT('en', 'translation')
    expect(getDiffBetweenDatesInString(
      new Date('1/29/2019'), new Date('1/26/2019'), t)).to.eq('3 days ago')
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


describe('getMonthName', (): void => {
  before((): void => {
    i18n.changeLanguage('fr')
    i18n.addResourceBundle('fr', 'translation', {})
    i18n.addResourceBundle('en', 'translation', {
      'janvier/février/mars/avril/mai/juin/juillet/août/septembre/octobre/novembre/décembre':
      'January/February/March/April/May/June/July/August/September/October/November/December',
    })
  })

  it('should return a French name', (): void => {
    const t = i18n.getFixedT('fr', 'any-namespace')
    expect(getMonthName(t, 'MARCH')).to.eq('mars')
  })

  it('should translate a month name', (): void => {
    i18n.changeLanguage('en')
    const t = i18n.getFixedT('en', 'any-namespace')
    expect(getMonthName(t, 'MARCH')).to.eq('March')
  })

  for (const month of (Object.keys(Month) as readonly bayes.bob.Month[])) {
    Month[month] && it(`should return a non-empty string for ${month}`, (): void => {
      const t = i18n.getFixedT('fr', 'any-namespace')
      expect(getMonthName(t, month)).to.not.be.empty
    })
  }
})

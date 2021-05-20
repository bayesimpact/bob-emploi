import * as Sentry from '@sentry/browser'
import i18n, {TFunction} from 'i18next'
import _memoize from 'lodash/memoize'

import {LocalizableString, combineTOptions, prepareT,
  prepareT as prepareTNoExtract} from 'store/i18n'


// Module to help with phrasing French sentences.
//
// If you fix any of the functions here, you'll probably want to update
// frontend/server/french.py as well.


// Use contract form of a word if the next word starts
// with a vowel or silent H.
export const maybeContract = (full: string, contracted: string, nextWord: string): string => {
  if (nextWord && /^[aehiouàâäèéêëïôöùûü]/i.test(nextWord)) {
    return contracted
  }
  return full
}


// Keep in sync with logic from https://github.com/StartupsPoleEmploi/labonnealternance/blob/master/frontend/src/services/helpers.js
// to avoid having incompatibilities.
const accentedList = [
  'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í',
  'î', 'ï', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', 'ø', 'ù', 'ú', 'û', 'ü', 'œ',
]
const unaccentedList = [
  'a', 'a', 'a', 'a', 'a', 'a', 'ae', 'c', 'e', 'e', 'e', 'e', 'i', 'i',
  'i', 'i', 'n', 'o', 'o', 'o', 'o', 'o', 'o', 'u', 'u', 'u', 'u', 'oe',
]
export const slugify = (term: string): string => {
  const lower = term.toLowerCase()
  const noAccents = lower.normalize ? lower.normalize('NFD').replace(/[\u0300-\u036F]/g, '') :
    accentedList.reduce((replacing: string, accented: string, index: number): string => {
      const unaccented = unaccentedList[index]
      return unaccented ? replacing.replace(accented, unaccented) : replacing
    }, lower)
  return noAccents.replace(/ /g, '-')
}


// Use contract form of a prefix in front of a word if it starts with a vowel
// or silent H.
export const maybeContractPrefix = (full: string, contracted: string, nextWord: string): string => {
  return maybeContract(full, contracted, nextWord) + nextWord
}


// Lower the first letter of a string.
export const lowerFirstLetter = (word: string): string => {
  if (word.length > 1) {
    const firstLetters = word.slice(0, 2)
    if (firstLetters.toUpperCase() === firstLetters) {
      return word
    }
  }
  return word.slice(0, 1).toLowerCase() + word.slice(1)
}


// Upper the first letter of a string.
export const upperFirstLetter = (word: string): string => {
  return word.slice(0, 1).toUpperCase() + word.slice(1)
}


// List of keywords that should stay as is if we find them. Note that this
// list is not exhaustive and can be completed when we run in more cases.
const alwaysUpperKeywords = new Set([
  'IBM', 'SARL', 'SAS', 'DGEA', 'RATP', 'SNCF', 'SNC', 'FNAC', 'SA', 'LCL', 'LIDL',
])


// Upper the first letter of each word of a string.
export const toTitleCase = (text: string): string => {
  const words = text.match(/(\w+(\W+|$))/g)
  if (!words) {
    return text
  }
  return words.map((word: string): string => {
    const trimmedWord = word.trim()
    if (alwaysUpperKeywords.has(trimmedWord)) {
      return word
    }
    return word.slice(0, 1).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()
  }).join('')
}


const oneDayInMillisecs = 1000 * 60 * 60 * 24


type TimeUnit = {
  days: number
  unit: LocalizableString
}


const deltaDays: readonly TimeUnit[] = [
  {days: 365, unit: prepareT('an', {count: 2})},
  {days: 30, unit: prepareT('mois', {count: 2})},
  {days: 7, unit: prepareT('semaine', {count: 2})},
  {days: 1, unit: prepareT('jour', {count: 2})},
  {days: 0, unit: prepareTNoExtract('')},
] as const

// Get difference between two dates or months expressed as a sentence
// e.g. "il y a 3 jours" or "il y a 2 mois".
export const getDiffBetweenDatesInString =
(firstDate: Date, secondDate: Date, t: TFunction): string => {
  const diffDate = Math.abs(firstDate.getTime() - secondDate.getTime())
  const diffInDays = Math.floor(diffDate / oneDayInMillisecs)
  const timeUnit = deltaDays.find(({days}: TimeUnit): boolean => diffInDays >= days)
  const translate = t
  if (!timeUnit) {
    return ''
  }
  if (!timeUnit.days) {
    return t("aujourd'hui")
  }
  const {days, unit} = timeUnit
  const numUnits = Math.floor(diffInDays / days)
  return t('il y a {{numUnits}} {{unit}}', {
    numUnits,
    unit: translate(...combineTOptions(unit, {count: numUnits})),
  })
}


export interface CityNameAndPrefix {
  cityName: string
  prefix: string
}


// Compute the prefix in front of a city name when writing about "in City C",
// e.g. "Toulouse" => "à ", "Le Mans", "au ". Also return the part of the city
// name without the prefix.
export const inCityPrefix = (fullName: string, t: TFunction): CityNameAndPrefix => {
  if (!fullName) {
    return {
      cityName: '',
      prefix: '',
    }
  }

  const translatedInCity = t('à {{cityName}}', {cityName: '{{cityName}}', ns: 'translation'})
  if (translatedInCity !== 'à {{cityName}}') {
    if (!translatedInCity.endsWith('{{cityName}}')) {
      Sentry.captureMessage(`Impossible to extract the prefix from "${translatedInCity}"`)
      return {cityName: fullName, prefix: 'à '}
    }
    return {
      cityName: fullName,
      prefix: translatedInCity.slice(0, translatedInCity.length - '{{cityName}}'.length),
    }
  }

  if (fullName.startsWith('Le ')) {
    return {
      cityName: fullName.slice(3),
      prefix: 'au ',
    }
  }
  if (fullName.startsWith('Les ')) {
    return {
      cityName: fullName.slice(4),
      prefix: 'aux ',
    }
  }
  const [, prefix, cityName] = fullName.match(/^L(a |')(.*)/) || []
  if (prefix && cityName) {
    return {
      cityName,
      prefix: 'à l' + lowerFirstLetter(prefix),
    }
  }
  return {
    cityName: fullName,
    prefix: 'à ',
  }
}


interface ModifiedNameAndPrefix {
  modifiedName: string
  prefix: string
}


// Compute the prefix in front of a name when writing about "of Name N",
// e.g. "Toulouse" => "de ", "Le Mans" => "du ", "Orange" => "d'". Also return the part of the
// name without the prefix.
export const ofPrefix = (fullName: string, t: TFunction): ModifiedNameAndPrefix => {
  if (t) {
    const translated = t('de {{fullName}}', {fullName, ns: 'translation'})
    if (!translated.startsWith('de ')) {
      return {
        modifiedName: fullName,
        prefix: translated.slice(0, translated.length - fullName.length),
      }
    }
  }
  if (/^[AEIOUY]/.test(fullName)) {
    return {
      modifiedName: fullName,
      prefix: "d'",
    }
  }
  if (fullName.startsWith('Le ')) {
    return {
      modifiedName: fullName.slice(3),
      prefix: 'du ',
    }
  }
  if (fullName.startsWith('Les ')) {
    return {
      modifiedName: fullName.slice(4),
      prefix: 'des ',
    }
  }
  const [, prefix, modifiedName] = fullName.match(/^L(a |')(.*)/) || []
  if (prefix && modifiedName) {
    return {
      modifiedName,
      prefix: 'de l' + lowerFirstLetter(prefix),
    }
  }
  return {
    modifiedName: fullName,
    prefix: 'de ',
  }
}

export const closeToCity = (cityName: string, t: TFunction): string => {
  const closeToCity = t('près de {{cityName}}', {cityName, ns: 'translation'})
  if (!closeToCity.startsWith('près de ')) {
    return closeToCity
  }
  const {modifiedName, prefix} = ofPrefix(cityName, t)
  return `près ${prefix}${modifiedName}`
}

export const inDepartement = (city: bayes.bob.FrenchCity, t: TFunction): string|null => {
  const {departementName = '', departementPrefix = ''} = city || {}
  const inDepartement = t('dans {{departementName}}', {departementName, ns: 'translation'})
  if (!inDepartement.startsWith('dans ')) {
    return inDepartement
  }
  if (departementName && departementPrefix) {
    return departementPrefix + departementName
  }
  return null
}


export const thanInDepartement = (city: bayes.bob.FrenchCity, t: TFunction): string|null => {
  const {departementName = '', departementPrefix = ''} = city || {}
  const inDepartement = t('que dans {{departementName}}', {departementName, ns: 'translation'})
  if (!inDepartement.startsWith('que dans ')) {
    return inDepartement
  }
  if (departementName && departementPrefix) {
    return maybeContract('que ', "qu'", departementPrefix + departementName)
  }
  return null
}


export const ofJobName = (jobName: string, t: TFunction): string => {
  const translated = t('de {{jobName}}', {jobName, ns: 'translation'})
  if (!translated.startsWith('de ')) {
    return translated
  }
  return maybeContractPrefix('de ', "d'", jobName)
}


export const genderize =
  (neutralSentence: string, herSentence: string, hisSentence: string,
    gender: bayes.bob.Gender|undefined): string => {
    switch (gender) {
      case 'FEMININE':
        return herSentence
      case 'MASCULINE':
        return hisSentence
    }
    return neutralSentence
  }


const getMonthsShort = _memoize(
  (t: TFunction): readonly string[] =>
    t('janv./févr./mars/avr./mai/juin/juil./août/sept./oct./nov./déc.', {ns: 'translation'}).
      split('/'),
  (): string => i18n.language,
)


export const getDateString = (timestamp: string | Date | number, t: TFunction): string => {
  const date = new Date(timestamp)
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  return `${day} ${getMonthsShort(t)[month]} ${year}`
}

const _getMonthNames = _memoize(
  (t: TFunction): readonly string[] =>
    t(
      'janvier/février/mars/avril/mai/juin/juillet/août/septembre/octobre/novembre/décembre',
      {ns: 'translation'},
    ).split('/'),
  (): string => i18n.language,
)


const _MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const
export const getMonthName = (translate: TFunction, month: bayes.bob.Month): string => {
  const monthAsIndex = _MONTHS.indexOf(month as (typeof _MONTHS)[number])
  return _getMonthNames(translate)[monthAsIndex] || ''
}

export const getPluralS = (count: number): string => count > 1 ? 's' : ''

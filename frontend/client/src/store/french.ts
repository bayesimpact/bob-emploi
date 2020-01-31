import * as Sentry from '@sentry/browser'
import i18n, {TFunction} from 'i18next'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import _pick from 'lodash/pick'

import {prepareNamespace} from 'store/i18n'

// TODO(pascal): Move these files to the store.
import adviceModulesVous from 'components/advisor/data/advice_modules.json'
import emailTemplatesVous from 'components/advisor/data/email_templates.json'
import categoriesVous from 'components/strategist/data/categories.json'
import goalsVous from 'components/strategist/data/goals.json'
import testimonialsVous from 'components/strategist/data/testimonials.json'

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
    accentedList.reduce((replacing: string, accented: string, index: number): string =>
      replacing.replace(accented, unaccentedList[index]), lower)
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
  plural: string
  singular: string
}


const deltaDays: readonly TimeUnit[] = [
  {days: 365, plural: 'ans', singular: 'an'},
  {days: 30, plural: 'mois', singular: 'mois'},
  {days: 7, plural: 'semaines', singular: 'semaine'},
  {days: 1, plural: 'jours', singular: 'jour'},
  {days: 0, plural: '', singular: ''},
] as const

// Get difference between two dates or months expressed as a sentence
// e.g. "il y a 3 jours" or "il y a 2 mois".
export const getDiffBetweenDatesInString = (firstDate: Date, secondDate: Date): string => {
  const diffDate = Math.abs(firstDate.getTime() - secondDate.getTime())
  const diffInDays = Math.floor(diffDate / oneDayInMillisecs)
  const timeUnit = deltaDays.find(({days}: TimeUnit): boolean => diffInDays >= days)
  if (!timeUnit) {
    return ''
  }
  if (!timeUnit.days) {
    return "aujourd'hui"
  }
  const {days, plural, singular} = timeUnit
  const dateDeltaInUnits = Math.floor(diffInDays / days)
  return `il y a ${dateDeltaInUnits} ${dateDeltaInUnits > 1 ? plural : singular}`
}


interface CityNameAndPrefix {
  cityName: string
  prefix: string
}


// Compute the prefix in front of a city name when writing about "in City C",
// e.g. "Toulouse" => "à ", "Le Mans", "au ". Also return the part of the city
// name without the prefix.
export const inCityPrefix = (fullName: string): CityNameAndPrefix => {
  if (!fullName) {
    return {
      cityName: '',
      prefix: '',
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
  const matches = fullName.match(/^L(a |')(.*)/)
  if (matches) {
    return {
      cityName: matches[2],
      prefix: 'à l' + lowerFirstLetter(matches[1]),
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
// TODO(pascal): Change all callers and make t required.
export const ofPrefix = (fullName: string, t?: TFunction): ModifiedNameAndPrefix => {
  if (t) {
    const translated = t('de {{fullName}}', {fullName, ns: 'translation'})
    if (!translated.startsWith('de ')) {
      return {
        modifiedName: fullName,
        prefix: translated.slice(0, translated.length - fullName.length),
      }
    }
  }
  if (fullName.match(/^[AEIOUY]/)) {
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
  const matches = fullName.match(/^L(a |')(.*)/)
  if (matches) {
    return {
      modifiedName: matches[2],
      prefix: 'de l' + lowerFirstLetter(matches[1]),
    }
  }
  return {
    modifiedName: fullName,
    prefix: 'de ',
  }
}

// TODO(pascal): Change all callers and make t required.
export const inDepartement = (city: bayes.bob.FrenchCity, t?: TFunction): string|null => {
  const {departementName = '', departementPrefix = ''} = city || {}
  if (t) {
    const inDepartement = t('dans {{departementName}}', {departementName})
    if (!inDepartement.startsWith('dans ')) {
      return inDepartement
    }
  }
  if (departementName && departementPrefix) {
    return departementPrefix + departementName
  }
  return null
}


export type YouChooser = <T>(tuVersion: T, vousVersion: T) => T


// TODO(pascal): Move to user.ts
export type ClientFilter = 'for-experienced(2)'|'for-experienced(6)'

interface EmailTemplate {
  readonly content: string
  readonly filters?: readonly ClientFilter[]
  readonly personalizations?: readonly string[]
  readonly reason?: string
  readonly title: string
}
interface EmailTemplates {
  readonly [adviceModule: string]: readonly EmailTemplate[]
}

export const tutoyer = <T>(tuSentence: T): T => tuSentence
export const vouvoyer = <V>(unusedTuSentence: V, vousSentence: V): V => vousSentence

export interface AdviceModule {
  callToAction?: string
  explanations?: readonly string[]
  goal: string
  shortTitle: string
  title: string
  titleXStars: {[num: string]: string}
  userGainCallout?: string
  userGainDetails?: string
}
interface AdviceModules {
  [adviceModule: string]: AdviceModule
}


// TODO(pascal): Move to i18n.ts.

function getFieldsTranslator<K extends string, T extends {readonly [k in K]?: string}>(
  translate: TFunction, keys: readonly K[], ns?: string): ((raw: T) => T) {
  if (ns) {
    prepareNamespace(ns)
  }
  return (raw: T): T => {
    const translated: {[k in K]: string|undefined} = _mapValues(
      _pick(raw, keys),
      (fieldValue?: string): string|undefined => fieldValue && translate(fieldValue, {ns}),
    )
    return {...raw, ...translated}
  }
}


const translatedAdviceModules = _memoize(
  (translate: TFunction): AdviceModules => {
    const translator = getFieldsTranslator<'goal'|'title'|'userGainDetails', AdviceModule>(
      translate, ['goal', 'title', 'userGainDetails'], 'adviceModules')
    const stringTranslate = (s: string): string => translate(s)
    const adviceModules: AdviceModules = adviceModulesVous
    return _mapValues(adviceModules, (adviceModule: AdviceModule): AdviceModule => ({
      ...translator(adviceModule),
      explanations: adviceModule.explanations?.map(stringTranslate),
      titleXStars: _mapValues(adviceModule.titleXStars, stringTranslate),
    }))
  },
  (): string => i18n.language,
)


const emptyObject = {} as const


export const getAdviceModule = (adviceModuleId: string, translate?: TFunction): AdviceModule => {
  const modules = translate ? translatedAdviceModules(translate) : adviceModulesVous
  return modules[adviceModuleId] || emptyObject
}


export interface StrategyGoal {
  content: string
  goalId: string
  stepTitle: string
}

const translatedGoals = _memoize(
  (translate: TFunction): {[k in keyof typeof goalsVous]: readonly StrategyGoal[]} => {
    const translator = getFieldsTranslator<'content'|'stepTitle', StrategyGoal>(
      translate, ['content', 'stepTitle'], 'goals')
    return _mapValues(goalsVous, goals => goals.map(translator))
  },
  (): string => i18n.language,
)


const emptyArray = [] as const


export const getStrategyGoals =
  (strategyId: string, translate?: TFunction): readonly StrategyGoal[] => {
    const goals = translate ? translatedGoals(translate) : goalsVous
    const strategyGoals = goals[strategyId as keyof typeof goalsVous] || emptyArray
    if (!strategyGoals.length) {
      Sentry.captureMessage(`No goals defined for the strategy "${strategyId}"`)
    }
    return strategyGoals
  }


interface DiagnosticCategoryMap {
  readonly [categoryId: string]: bayes.bob.DiagnosticCategory
}


export const getTranslatedCategories = _memoize(
  (translate: TFunction): DiagnosticCategoryMap => {
    return _mapValues(
      categoriesVous,
      getFieldsTranslator(
        translate, ['metricDetails', 'metricDetailsFeminine', 'metricTitle'], 'categories'),
    )
  },
  (): string => i18n.language,
)


export const getEmailTemplates = _memoize(
  (translate: TFunction): EmailTemplates => {
    // TODO(cyrille): Load lazily if files get too big.
    const emailTemplates: EmailTemplates = emailTemplatesVous
    const translator = getFieldsTranslator<'content'|'reason'|'title', EmailTemplate>(
      translate, ['content', 'reason', 'title'], 'emailTemplates')
    return _mapValues(
      emailTemplates,
      (values: readonly EmailTemplate[]): readonly EmailTemplate[] => values.map(translator),
    )
  },
  (): string => i18n.language,
)


export interface StrategyTestimonial {
  readonly content: string
  readonly createdAt: string
  readonly isMale?: boolean
  readonly job: string
  readonly name: string
  readonly rating: number
}

interface StrategyTestimonials {
  readonly [strategy: string]: readonly StrategyTestimonial[]
}


export const getStrategiesTestimonials = _memoize(
  (translate: TFunction): StrategyTestimonials => {
    const testimonials: StrategyTestimonials = testimonialsVous
    const translator = getFieldsTranslator<'content'|'job', StrategyTestimonial>(
      translate, ['content', 'job'], 'testimonials')
    return _mapValues(
      testimonials,
      (values: readonly StrategyTestimonial[]): readonly StrategyTestimonial[] =>
        values.map(translator),
    )
  },
  (): string => i18n.language,
)

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


const monthsShort = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const getDateString = (timestamp: string | Date | number): string => {
  const date = new Date(timestamp)
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  return `${day} ${monthsShort[month]} ${year}`
}

/* eslint-disable sort-keys */
const _FRENCH_MONTHS = {
  JANUARY: 'janvier',
  FEBRUARY: 'février',
  MARCH: 'mars',
  APRIL: 'avril',
  MAY: 'mai',
  JUNE: 'juin',
  JULY: 'juillet',
  AUGUST: 'août',
  SEPTEMBER: 'septembre',
  OCTOBER: 'octobre',
  NOVEMBER: 'novembre',
  DECEMBER: 'décembre',
  UNKNOWN_MONTH: '',
} as const
/* eslint-enable sort-keys */
export const getMonthName = (month: bayes.bob.Month): string =>
  _FRENCH_MONTHS[month] || ''

export const getPluralS = (count: number): string => count > 1 ? 's' : ''

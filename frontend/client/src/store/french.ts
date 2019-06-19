// TODO(pascal): Move these files to the store.
import adviceModulesTu from 'components/advisor/data/advice_modules_fr_FR@tu.json'
import adviceModulesVous from 'components/advisor/data/advice_modules.json'
import emailTemplatesTu from 'components/advisor/data/email_templates_fr_FR@tu.json'
import emailTemplatesVous from 'components/advisor/data/email_templates.json'
import eventsTu from 'components/advisor/data/events_fr_FR@tu.json'
import eventsVous from 'components/advisor/data/events.json'
import goalsTu from 'components/strategist/data/goals_fr_FR@tu.json'
import goalsVous from 'components/strategist/data/goals.json'
import testimonialsTu from 'components/strategist/data/testimonials_fr_FR@tu.json'
import testimonialsVous from 'components/strategist/data/testimonials.json'

// Module to help with phrasing French sentences.
//
// If you fix any of the functions here, you'll probably want to update
// frontend/server/french.py as well.


// Use contract form of a word if the next word starts
// with a vowel or silent H.
export const maybeContract = (full: string, contracted: string, nextWord: string): string => {
  if (nextWord && /^[aâàäeéêëèhiïoôöuùûü]/i.test(nextWord)) {
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
  const noAccents = lower.normalize ? lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '') :
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
    const firstLetters = word.substr(0, 2)
    if (firstLetters.toUpperCase() === firstLetters) {
      return word
    }
  }
  return word.substr(0, 1).toLowerCase() + word.substr(1)
}


// Upper the first letter of a string.
export const upperFirstLetter = (word: string): string => {
  return word.substr(0, 1).toUpperCase() + word.substr(1)
}


// List of keywords that should stay as is if we find them. Note that this
// list is not exhaustive and can be completed when we run in more cases.
const alwaysUpperKeywords = new Set([
  'IBM', 'SARL', 'SAS', 'DGEA', 'RATP', 'SNCF', 'SNC', 'FNAC', 'SA', 'LCL', 'LIDL',
])


// Upper the first letter of each word of a string.
export const toTitleCase = (text: string): string => {
  return text.match(/([\w]+(\W+|$))/g).
    map((word: string): string => {
      const trimmedWord = word.trim()
      if (alwaysUpperKeywords.has(trimmedWord)) {
        return word
      }
      return word.substr(0, 1).toLocaleUpperCase() + word.substr(1).toLocaleLowerCase()
    }).
    join('')
}


const oneDayInMillisecs = 1000 * 60 * 60 * 24
// Get difference between two dates or months expressed as a sentence
// e.g. "il y a 3 jours" or "il y a 2 mois".
export const getDiffBetweenDatesInString = (firstDate: Date, secondDate: Date): string => {
  const diffDate = Math.abs(firstDate.getTime() - secondDate.getTime())
  const diffInDays = Math.floor(diffDate / oneDayInMillisecs)
  if (diffInDays === 0) {
    return "aujourd'hui"
  }
  if (diffInDays > 30) {
    return `il y a ${Math.floor(diffInDays / 30)} mois`
  }
  return `il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`
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
      cityName: fullName.substr(3),
      prefix: 'au ',
    }
  }
  if (fullName.startsWith('Les ')) {
    return {
      cityName: fullName.substr(4),
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
export const ofPrefix = (fullName: string): ModifiedNameAndPrefix => {
  if (fullName.match(/^[AEIOUY]/)) {
    return {
      modifiedName: fullName,
      prefix: "d'",
    }
  }
  if (fullName.startsWith('Le ')) {
    return {
      modifiedName: fullName.substr(3),
      prefix: 'du ',
    }
  }
  if (fullName.startsWith('Les ')) {
    return {
      modifiedName: fullName.substr(4),
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

// TODO(cyrille): Use wherever applicable.
export const inDepartement = (city: bayes.bob.FrenchCity): string => {
  const {departementName = '', departementPrefix = ''} = city || {}
  if (departementName && departementPrefix) {
    return departementPrefix + departementName
  }
  return null
}


export type YouChooser = <T>(tuVersion: T, vousVersion: T) => T


interface EventText {
  atNext: string
  eventLocation: string
}
interface EventTexts {
  [prefix: string]: EventText
}

const canTutoieFrom = (userYou: YouChooser): boolean => userYou && userYou(true, false)
// TODO(cyrille): Drop this.
export const getEvents = (userYou: YouChooser): EventTexts =>
  canTutoieFrom(userYou) ? eventsTu : eventsVous

interface EmailTemplate {
  readonly content: string
  readonly filters?: string[]
  readonly personalizations?: string[]
  readonly reason?: string
  readonly title: string
}
interface EmailTemplates {
  readonly [adviceModule: string]: EmailTemplate[]
}

export const tutoyer = <T>(tuSentence: T): T => tuSentence
export const vouvoyer = <V>(unusedTuSentence: V, vousSentence: V): V => vousSentence

// TODO(cyrille): Load lazily if files get too big.
export const getEmailTemplates = (userYou: YouChooser = tutoyer): EmailTemplates =>
  canTutoieFrom(userYou) ? emailTemplatesTu : emailTemplatesVous

export interface AdviceModule {
  callToAction?: string
  explanations?: string[]
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

export const getAdviceModules = (userYou: YouChooser): AdviceModules =>
  canTutoieFrom(userYou) ? adviceModulesTu : adviceModulesVous

export interface StrategyGoal {
  content: string
  goalId: string
}

interface StrategyGoals {
  [strategy: string]: StrategyGoal[]
}


export const getStrategiesGoals = (userYou: YouChooser): StrategyGoals =>
  canTutoieFrom(userYou) ? goalsTu : goalsVous

interface StrategyTestimonial {
  readonly content: string
  readonly createdAt: string
  readonly isMale?: boolean
  readonly job: string
  readonly name: string
  readonly rating: number
}

interface StrategyTestimonials {
  readonly [strategy: string]: StrategyTestimonial[]
}


export const getStrategiesTestimonials = (userYou: YouChooser): StrategyTestimonials =>
  userYou(testimonialsTu, testimonialsVous)

export const genderize =
  (neutralSentence: string, herSentence: string, hisSentence: string, gender: string): string => {
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
export const getDateString = (timestamp: string | Date): string => {
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
} as const
/* eslint-enable sort-keys */
export const getMonthName = (month: bayes.bob.Month): string =>
  _FRENCH_MONTHS[month] || ''

export const getPluralS = (count: number): string => count > 1 ? 's' : ''

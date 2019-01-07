// TODO(pascal): Move these files to the store.
import adviceModulesTu from 'components/advisor/data/advice_modules_fr_FR@tu.json'
import adviceModulesVous from 'components/advisor/data/advice_modules.json'
import emailTemplatesTu from 'components/advisor/data/email_templates_fr_FR@tu.json'
import emailTemplatesVous from 'components/advisor/data/email_templates.json'
import eventsTu from 'components/advisor/data/events_fr_FR@tu.json'
import eventsVous from 'components/advisor/data/events.json'

// Module to help with phrasing French sentences.
//
// If you fix any of the functions here, you'll probably want to update
// frontend/server/french.py as well.


// Use contract form of a word if the next word starts
// with a vowel or silent H.
export const maybeContract = (full, contracted, nextWord) => {
  if (nextWord && /^[aâàäeéêëèhiïoôöuùûü]/i.test(nextWord)) {
    return contracted
  }
  return full
}


// Use contract form of a prefix in front of a word if it starts with a vowel
// or silent H.
export const maybeContractPrefix = (full, contracted, nextWord) => {
  return maybeContract(full, contracted, nextWord) + nextWord
}


// Lower the first letter of a string.
export const lowerFirstLetter = word => {
  return word.substr(0, 1).toLowerCase() + word.substr(1)
}


// Upper the first letter of a string.
export const upperFirstLetter = word => {
  return word.substr(0, 1).toUpperCase() + word.substr(1)
}


// List of keywords that should stay as is if we find them. Note that this
// list is not exhaustive and can be completed when we run in more cases.
const alwaysUpperKeywords = new Set([
  'IBM', 'SARL', 'SAS', 'DGEA', 'RATP', 'SNCF', 'SNC', 'FNAC', 'SA', 'LCL', 'LIDL',
])


// Upper the first letter of each word of a string.
export const toTitleCase = text => {
  return text.match(/([\w]+(\W+|$))/g).
    map(word => {
      const trimmedWord = word.trim()
      if (alwaysUpperKeywords.has(trimmedWord)) {
        return word
      }
      return word.substr(0, 1).toLocaleUpperCase() + word.substr(1).toLocaleLowerCase()
    }).
    join('')
}


// Compute the prefix in front of a city name when writing about "in City C",
// e.g. "Toulouse" => "à ", "Le Mans", "au ". Also return the part of the city
// name without the prefix.
export const inCityPrefix = fullName => {
  if (!fullName) {
    return {
      cityName: '',
      prefix: '',
    }
  }
  if (fullName.match(/^Le /)) {
    return {
      cityName: fullName.substr(3),
      prefix: 'au ',
    }
  }
  if (fullName.match(/^Les /)) {
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


// Compute the prefix in front of a name when writing about "of Name N",
// e.g. "Toulouse" => "de ", "Le Mans" => "du ", "Orange" => "d'". Also return the part of the
// name without the prefix.
export const ofPrefix = fullName => {
  if (fullName.match(/^[AEIOUY]/)) {
    return {
      modifiedName: fullName,
      prefix: "d'",
    }
  }
  if (fullName.match(/^Le /)) {
    return {
      modifiedName: fullName.substr(3),
      prefix: 'du ',
    }
  }
  if (fullName.match(/^Les /)) {
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
export const inDepartement = city => {
  const {departementName, departementPrefix} = city || {}
  if (departementName && departementPrefix) {
    return departementPrefix + departementName
  }
  return null
}


const canTutoieFrom = userYou => userYou && userYou(true, false)
// TODO(cyrille): Drop this.
export const getEvents = (userYou) => canTutoieFrom(userYou) ? eventsTu : eventsVous

// TODO(cyrille): Load lazily if files get too big.
export const getEmailTemplates = userYou =>
  canTutoieFrom(userYou) ? emailTemplatesTu : emailTemplatesVous

export const getAdviceModules = userYou =>
  canTutoieFrom(userYou) ? adviceModulesTu : adviceModulesVous


export const genderize = (neutralSentence, herSentence, hisSentence, gender) => {
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
export const getDateString = timestamp => {
  const date = new Date(timestamp)
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  return `${day} ${monthsShort[month]} ${year}`
}

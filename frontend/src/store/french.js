// Module to help with phrasing French sentences.


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


// Compute the prefix in front of a city name when writing about "in City C",
// e.g. "Toulouse" => "à ", "Le Mans", "au ". Also return the part of the city
// name without the prefix.
export const inCityPrefix = fullName => {
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


// Compute the prefix in front of a city name when writing about "of City C",
// e.g. "Toulouse" => "de ", "Le Mans", "du ". Also return the part of the city
// name without the prefix.
export const ofCityPrefix = fullName => {
  if (fullName.match(/^Le /)) {
    return {
      cityName: fullName.substr(3),
      prefix: 'du ',
    }
  }
  if (fullName.match(/^Les /)) {
    return {
      cityName: fullName.substr(4),
      prefix: 'des ',
    }
  }
  const matches = fullName.match(/^L(a |')(.*)/)
  if (matches) {
    return {
      cityName: matches[2],
      prefix: 'de l' + lowerFirstLetter(matches[1]),
    }
  }
  return {
    cityName: fullName,
    prefix: 'de ',
  }
}

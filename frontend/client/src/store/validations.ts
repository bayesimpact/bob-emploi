// Regex from https://stackoverflow.com/a/1373724/4482064
const emailRegexp = new RegExp(
  '^[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)' +
  '*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$')


// Returns true for a string containing a valid email. false otherwise.
function validateEmail(value?: string): value is string {
  return !!value && emailRegexp.test(value)
}


const objectIdRegexp = /^[\da-f]{24}$/


// Returns true for a string containing a valid mongoDB ObjectId. false otherwise.
function validateObjectId(value: string): boolean {
  return objectIdRegexp.test(value)
}


const passwordRequiredComplexity = 12
const passwordStrongComplexity = 25

interface PasswordValidation {
  isStrongEnough: boolean
  // Score 0 is very weak, score 100 (cap) is the best one could achieve.
  score: number
}

// Returns a score for password complexity.
// See https://www.ssi.gouv.fr/administration/precautions-elementaires/calculer-la-force-dun-mot-de-passe/
// The complexity we user here is the length of a digits-only password that would be equivalent to
// brute-force break.
// Some examples of complexity:
//  - 4 digits: 4
//  - 8 letters & digits: 12.4
//  - 10 letters: 14.1
//  - 12 letters upper + lower + digits + special chars: 18.6
function scorePasswordComplexity(value: string): PasswordValidation {
  const hasDigits = /\d/.test(value)
  const hasLowercase = /[a-z]/.test(value)
  const hasUppercase = /[A-Z]/.test(value)
  const hasSimpleSpecialChars = /[ !#$%*.?_-]/.test(value)
  const hasOthers = /[^\w !#$%*.?-]/.test(value)
  const entropy = (hasDigits ? 10 : 0) + (hasLowercase ? 26 : 0) + (hasUppercase ? 26 : 0) +
    (hasSimpleSpecialChars ? 10 : 0) + (hasOthers ? 20 : 0)
  if (entropy <= 0) {
    return {isStrongEnough: false, score: 0}
  }
  const score = Math.log10(entropy) * value.length
  return {
    isStrongEnough: score > passwordRequiredComplexity,
    score: Math.round(Math.min(100, Math.max(0, (score - passwordStrongComplexity) /
      (passwordStrongComplexity - passwordRequiredComplexity) * 60 + 100))),
  }
}


export {scorePasswordComplexity, validateEmail, validateObjectId}

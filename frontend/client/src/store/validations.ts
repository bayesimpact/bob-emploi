// Regex from https://stackoverflow.com/a/1373724/4482064
const emailRegexp = new RegExp(
  '^[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)' +
  '*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$')


// Returns true for a string containing a valid email. false otherwise.
function validateEmail(value: string): boolean {
  return emailRegexp.test(value)
}


const objectIdRegexp = /^[\da-f]{24}$/


// Returns true for a string containing a valid mongoDB ObjectId. false otherwise.
function validateObjectId(value: string): boolean {
  return objectIdRegexp.test(value)
}


export {validateEmail, validateObjectId}

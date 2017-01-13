// Returns true for a string containing a valid email. false otherwise.
function validateEmail(value) {
  // Regex from http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
  // Second answer.
  var re = new RegExp('^[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)' +
    '*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$')
  return re.test(value)
}


// Check whether a date, specified by year and month, is in the past.
// The month we are currently in is considered as lying in the past.
function dateInPast(year, month) {
  if (!year || month === undefined) {
    return false
  }
  const selectedDate = new Date(year, month)
  return selectedDate < new Date()
}

export {validateEmail, dateInPast}

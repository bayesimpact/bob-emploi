// Returns true for a string containing a valid email. false otherwise.
function validateEmail(value) {
  // Regex from http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
  // Second answer.
  var re = new RegExp('^[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)' +
    '*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$')
  return re.test(value)
}


export {validateEmail}

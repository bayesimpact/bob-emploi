interface FullName {
  lastName: string
  name: string
}

// When using Facebook login, we only get one value for the name,
// but want to use this value to fill out the first and the last name of a user.
// TODO: That's a very simple approach that misses many cases. For example last
// names with spaces: Jean de la Rochebrochard should split between Jean and
// de la Rochebrochard
function splitFullName(fullName: string): FullName {
  let name = ''
  let lastName = ''
  if (fullName) {
    const splitName = fullName.split(' ')
    name = splitName[0]
    if (splitName.length > 1) {
      lastName = splitName[splitName.length - 1]
    }
  }
  return {lastName, name}
}

export {splitFullName}

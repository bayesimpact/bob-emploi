function onboardingComplete(user) {
  if (!user || !user.profile) {
    return false
  }
  const {email, gender, name, yearOfBirth, highestDegree, lastName} = user.profile
  const hasCompletedFirstProject =
    user.projects && user.projects[0] && !user.projects[0].isIncomplete
  return !!(gender && name && yearOfBirth && email && highestDegree && lastName
    && hasCompletedFirstProject)
}

const mainSelector = function(state) {
  return {
    ...state,
    user: {
      ...state.user,
      onboardingComplete: state.user && onboardingComplete(state.user),
    },
  }
}


export {mainSelector, onboardingComplete}

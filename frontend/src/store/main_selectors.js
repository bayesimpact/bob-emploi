function onboardingComplete(user) {
  if (!user || !user.profile) {
    return false
  }
  const {email, gender, name, yearOfBirth, highestDegree, lastName} = user.profile
  const hasProject = (user.projects || []).some(project => !project.isIncomplete)
  return !!(gender && name && yearOfBirth && email && highestDegree && lastName
      && hasProject)
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

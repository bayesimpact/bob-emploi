function onboardingComplete(user) {
  if (!user || !user.profile) {
    return false
  }
  const {gender, name, yearOfBirth, highestDegree, lastName} = user.profile
  const hasCompletedFirstProject =
    user.projects && user.projects[0] && !user.projects[0].isIncomplete
  return !!(gender && name && yearOfBirth && highestDegree && lastName
    && hasCompletedFirstProject)
}

export {onboardingComplete}

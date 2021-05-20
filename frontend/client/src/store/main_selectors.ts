function onboardingComplete(user: bayes.bob.User | null): boolean {
  if (!user || !user.profile) {
    return false
  }
  const {name, yearOfBirth, highestDegree} = user.profile
  const hasCompletedFirstProject =
    user.projects && user.projects[0] && !user.projects[0].isIncomplete
  return !!(name && yearOfBirth && highestDegree && hasCompletedFirstProject)
}

// eslint-disable-next-line import/prefer-default-export
export {onboardingComplete}

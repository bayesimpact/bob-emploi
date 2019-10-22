function onboardingComplete(user: bayes.bob.User | null): boolean {
  if (!user || !user.profile) {
    return false
  }
  const {gender, name, yearOfBirth, highestDegree} = user.profile
  const hasCompletedFirstProject =
    user.projects && user.projects[0] && !user.projects[0].isIncomplete
  return !!(gender && name && yearOfBirth && highestDegree && hasCompletedFirstProject)
}

export {onboardingComplete}

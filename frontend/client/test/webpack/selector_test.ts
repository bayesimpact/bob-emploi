import {expect} from 'chai'
import {onboardingComplete} from 'store/main_selectors'

type CompleteUser = bayes.bob.User & {
  profile: bayes.bob.UserProfile
  projects: [{projectId: string}]
}

function getCompleteUser(): CompleteUser {
  return {
    profile: {
      email: 'demenageur.persona@gmail.com',
      gender: 'MASCULINE',
      highestDegree: 'CAP_BEP',
      lastName: 'Dupont',
      name: 'Demenageur',
      yearOfBirth: 1983,
    },
    projects: [{projectId: 'test'}],
  }
}

describe('Onboarding complete', (): void => {
  it('should return false for an empty user', (): void => {
    const result = onboardingComplete({})
    expect(result).to.equal(false)
  })

  it('should return true for a totally complete profile', (): void => {
    const result = onboardingComplete(getCompleteUser())
    expect(result).to.equal(true)
  })

  const requiredFields = [
    'highestDegree', 'name', 'yearOfBirth',
  ] as const
  for (const field of requiredFields) {
    it(`should return false for the required field "${field}" missing`, (): void => {
      const user = getCompleteUser()
      delete user.profile[field]
      const result = onboardingComplete(user)
      expect(result).to.equal(false)
    })
  }

  it('should return false if the user does not have a project yet', (): void => {
    const user = {
      ...getCompleteUser(),
      projects: [],
    }
    const result = onboardingComplete(user)
    expect(result).to.equal(false)
  })

  it('should return false if the user has an incomplete project', (): void => {
    const completeUser = getCompleteUser()
    const user = {
      ...completeUser,
      projects: completeUser.projects.map((project, index): bayes.bob.Project =>
        index ? project : {...project, isIncomplete: true}),
    }
    const result = onboardingComplete(user)
    expect(result).to.equal(false)
  })

  it('should return false if the user has both a complete and an incomplete project', (): void => {
    // See issue #4980 for full context.
    const completeUser = getCompleteUser()
    const user = {
      ...completeUser,
      projects: [...completeUser.projects.map((project, index): bayes.bob.Project =>
        index ? project : {...project, isIncomplete: true}), {projectId: '1'}],
    }
    const result = onboardingComplete(user)
    expect(result).to.equal(false)
  })
})


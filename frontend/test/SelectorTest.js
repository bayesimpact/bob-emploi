var chai = require('chai')
var expect = chai.expect
import {onboardingComplete} from 'store/main_selectors'

function getCompleteUser() {
  return {
    'profile': {
      'email': 'demenageur.persona@gmail.com',
      'gender': 'MASCULINE',
      'highestDegree': 'CAP_BEP',
      'lastName': 'Dupont',
      'name': 'Demenageur',
      'yearOfBirth': 1983,
    },
    projects: [{projectId: 'test'}],
  }
}

describe('Onboarding complete', () => {
  it('should return false for an empty user', () => {
    const result = onboardingComplete({})
    expect(result).to.equal(false)
  })

  it('should return true for a totally complete profile', () => {
    const result = onboardingComplete(getCompleteUser())
    expect(result).to.equal(true)
  })

  const requiredFields = [
    'email', 'gender', 'highestDegree', 'lastName', 'name', 'yearOfBirth',
  ]
  for (let i = 0; i < requiredFields.length; i++) {
    const field = requiredFields[i]
    it(`should return false for the required field "${field}" missing`, () => {
      const user = getCompleteUser()
      delete user.profile[field]
      const result = onboardingComplete(user)
      expect(result).to.equal(false)
    })
  }

  it('should return false if the user does not have a project yet', () => {
    const user = getCompleteUser()
    user.projects = []
    const result = onboardingComplete()
    expect(result).to.equal(false)
  })

  it('should return false if the user has an incomplete project', () => {
    const user = getCompleteUser()
    user.projects[0].isIncomplete = true
    const result = onboardingComplete()
    expect(result).to.equal(false)
  })
})


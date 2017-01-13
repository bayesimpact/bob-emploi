/* eslint-env mocha */
var chai = require('chai')
var expect = chai.expect
import {onboardingComplete, shouldShowFirstWelcomeBackScreen,
        shouldShowSecondWelcomeBackScreen} from 'store/main_selectors'

// TODO(stephan): Add tests for selector functions in `main_selectors`.

function getUser() {
  return {
    interactions: {
      hasSeenFirstWelcomeBack: false,
      hasSeenSecondWelcomeBack: false,
    },
    projects: [{
      actions: [{status: 'ACTION_CURRENT'}],
    }],
    requestedByUserAtDate: '2016-11-23T12:39:59Z',
  }
}

describe('Welcome Back selectors', () => {

  it('should not trigger first welcome if the user did not have an action plan before', () => {
    const user = getUser()
    user.projects[0].actions = []
    user.registeredAt = '2015-11-23T12:39:59Z'
    const result = shouldShowFirstWelcomeBackScreen(user)
    expect(result).to.equal(false)
  })

  it('should trigger first welcome if the user has an action plan', () => {
    const user = getUser()
    user.registeredAt = '2015-11-23T12:39:59Z'
    const result = shouldShowFirstWelcomeBackScreen(user)
    expect(result).to.equal(true)
  })

  it('should not trigger second welcome if the user did not have an action plan before', () => {
    const user = getUser()
    user.projects[0].actions = []
    user.requestedByUserAtDate = '2015-11-23T12:39:59Z'
    const result = shouldShowSecondWelcomeBackScreen(user)
    expect(result).to.equal(false)
  })

  it('should trigger second welcome if the user has an action plan', () => {
    const user = getUser()
    user.requestedByUserAtDate = '2015-11-23T12:39:59Z'
    const result = shouldShowSecondWelcomeBackScreen(user)
    expect(result).to.equal(true)
  })
})

function getCompleteProfile() {
  return {
    'city': {
      'cityId': '01053',
      'departementId': '01',
      'departementName': 'Ain',
      'name': 'Bourg-en-Bresse',
      'regionId': '84',
      'regionName': 'Auvergne-Rhône-Alpes',
    },
    'contractTypeFlexibility': 'YES',
    'email': 'demenageur.persona@gmail.com',
    'englishLevelEstimate': 1,
    'gender': 'MASCULINE',
    'geographicalFlexibility': 'YES',
    'highestDegree': 'CAP_BEP',
    'lastName': 'Dupont',
    'latestJob': {
      'codeOgr': '12748',
      'jobGroup': {
        'name': 'Assistanat commercial',
        'romeId': 'D1401',
      },
      'name': 'Commercial / Commerciale sédentaire',
    },
    'name': 'Demenageur',
    'officeSkillsEstimate': 1,
    'professionalFlexibility': 'YES',
    'salaryRequirementFlexibility': 'YES',
    'situation': 'LOST_QUIT',
    'trainingFlexibility': 'YES',
    'yearOfBirth': 1983,
  }
}

describe('Onboarding complete', () => {
  it('should return false for an empty profile', () => {
    const result = onboardingComplete({})
    expect(result).to.equal(false)
  })

  it('should return true for a totally complete profile', () => {
    const result = onboardingComplete(getCompleteProfile())
    expect(result).to.equal(true)
  })

  const requiredFields = [
    'city', 'email', 'gender', 'highestDegree',
    'lastName', 'name', 'situation', 'yearOfBirth',
    'latestJob', 'englishLevelEstimate', 'officeSkillsEstimate',
    'contractTypeFlexibility', 'geographicalFlexibility', 'professionalFlexibility',
    'salaryRequirementFlexibility', 'trainingFlexibility',
  ]
  for (let i = 0; i < requiredFields.length; i++) {
    const field = requiredFields[i]
    it(`should return false for the required field "${field}" missing`, () => {
      const profile = getCompleteProfile()
      delete profile[field]
      const result = onboardingComplete(profile)
      expect(result).to.equal(false)
    })
  }
})


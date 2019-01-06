import {expect} from 'chai'
import {FamilySituation, Frustration, UserOrigin} from 'api/user'
import {getUserFrustrationTags, getFamilySituationOptions, increaseRevision,
  getHighestDegreeDescription, ORIGIN_OPTIONS, keepMostRecentRevision,
  isEmailTemplatePersonalized, projectMatchAllFilters, filterPredicatesMatch,
  personalizationsPredicates, youForUser} from 'store/user'
import emailTemplates from 'components/advisor/data/email_templates.json'


describe('frustrations', () => {
  it('should not return any frustrations if unknown', () => {
    const profile = {frustrations: ['UNKNOWN_JOB_SEARCH_FRUSTRATION']}
    const result = getUserFrustrationTags(profile)
    expect(result.length).to.equal(0)
  })

  it('should return the good number of frustrations for the most important ones', () => {
    const profile = {frustrations: [
      'NO_OFFERS', 'NO_OFFER_ANSWERS', 'MOTIVATION', 'TRAINING']}
    const result = getUserFrustrationTags(profile)
    expect(result.length).to.equal(4)
  })

  it('should not return any frustrations if frustrations undefined', () => {
    const profile = {}
    const result = getUserFrustrationTags(profile)
    expect(result.length).to.equal(0)
  })
})


describe('email personalization', () => {
  it('should return true for personalization matching frustrations', () => {
    const profile = {frustrations: ['UNKNOWN_JOB_SEARCH_FRUSTRATION']}
    const personalizations = ['UNKNOWN_JOB_SEARCH_FRUSTRATION']
    const result = isEmailTemplatePersonalized(personalizations, profile, {})
    expect(result).to.be.true
  })

  it('should return false if personalization is not a frustrations and nothing else', () => {
    const profile = {frustrations: ['UNKNOWN_JOB_SEARCH_FRUSTRATION']}
    const personalizations = ['UNKNOWN_JOB_SEARCH_FRUSTRATION_2']
    const result = isEmailTemplatePersonalized(personalizations, profile, {})
    expect(result).to.be.false
  })

  it('should return true for graduates', () => {
    const profile = {highestDegree: 'LICENCE_MAITRISE'}
    const personalizations = ['GRADUATE', 'WHATEVER']
    const result = isEmailTemplatePersonalized(personalizations, profile, {})
    expect(result).to.be.true
  })

  it('should return true for adequate network', () => {
    const profile = {}
    const project = {networkEstimate: 3}
    const personalizations = ['NETWORK_SCORE_3']
    const result = isEmailTemplatePersonalized(personalizations, profile, project)
    expect(result).to.be.true
  })

  it('should return false for the same job personalization if the user has not done it', () => {
    const profile = {}
    const project = {previousJobSimilarity: 'NEVER_DONE'}
    const personalizations = ['SAME_JOB']
    const result = isEmailTemplatePersonalized(personalizations, profile, project)
    expect(result).to.be.false
  })
})


describe('projectMatchAllFilters', () => {
  it('should match if there are no filters', () => {
    const filters = []
    const project = {seniority: 'UNKNOWN'}
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.true
  })

  it('should not match for juniors with for-experienced(2)', () => {
    const filters = ['for-experienced(2)']
    const project = {seniority: 'JUNIOR'}
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.false
  })

  it('should match intermediary with for-experienced(2)', () => {
    const filters = ['for-experienced(2)']
    const project = {seniority: 'INTERMEDIARY'}
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.true
  })

  it('should not match intermediary with for-experienced(6)', () => {
    const filters = ['for-experienced(6)']
    const project = {seniority: 'INTERMEDIARY'}
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.false
  })

  it('should match intermediary with for-experienced(6)', () => {
    const filters = ['for-experienced(6)']
    const project = {seniority: 'SENIOR'}
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.true
  })
})


describe('getHighestDegreeDescription', () => {
  it('should not return any description if there is no degree', () => {
    const profile = {highestDegree: 'NO_DEGREE'}
    expect(getHighestDegreeDescription(profile)).undefined
  })

  it('should not return any description if there is an unknown degree', () => {
    const profile = {highestDegree: 'random'}
    expect(getHighestDegreeDescription(profile)).undefined
  })

  it('should return the right degree', () => {
    const profile = {highestDegree: 'DEA_DESS_MASTER_PHD'}
    expect(getHighestDegreeDescription(profile)).to.equal('DEA - DESS - Master - PhD')
  })
})


describe('getFamilySituationOptions', () => {
  const familySituations = getFamilySituationOptions()
  familySituations.forEach(situation => it(`"${situation.name}" should have correct values`, () => {
    expect(situation).to.contain.all.keys('name', 'value')
    const {name, value} = situation
    expect(name).to.be.ok
    expect(value).to.be.ok
    expect(FamilySituation).to.contain.keys(value)
  }))
})


describe('ORIGIN_OPTIONS', () => {
  ORIGIN_OPTIONS.forEach(option => it(`"${option.name}" should have correct values`, () => {
    expect(option).to.contain.all.keys('name', 'value')
    const {name, value} = option
    expect(name).to.be.ok
    expect(value).to.be.ok
    expect(UserOrigin).to.contain.keys(value)
  }))
})


describe('increaseRevision', () => {
  it('should start at 1 when there are no revisions yet', () => {
    const modifiedUser = increaseRevision({})
    expect(modifiedUser.revision).to.eq(1)
  })

  it('should increase the revision number', () => {
    const modifiedUser = increaseRevision({revision: 4})
    expect(modifiedUser.revision).to.eq(5)
  })

  it('should not modify other fields', () => {
    const modifiedUser = increaseRevision({revision: 5, veryCool: 'yep'})
    expect(modifiedUser.veryCool).to.eq('yep')
  })
})


describe('keepMostRecentRevision', () => {
  it('should return the server version if a revision is missing', () => {
    const user = keepMostRecentRevision({origin: 'client'}, {origin: 'server'})
    expect(user.origin).to.eq('server')
  })

  it('should return the server version if it has new data', () => {
    const user = keepMostRecentRevision(
      {origin: 'client', revision: 1},
      {origin: 'server', revision: 2})
    expect(user.origin).to.eq('server')
  })

  it('should keep the client version if it has newer data', () => {
    const user = keepMostRecentRevision(
      {origin: 'client', revision: 3},
      {origin: 'server', revision: 2})
    expect(user.origin).to.eq('client')
  })

  it('should keep the client version if the server data is equal', () => {
    const user = keepMostRecentRevision(
      {origin: 'client', revision: 2},
      {origin: 'server', revision: 2})
    expect(user.origin).to.eq('client')
  })
})


describe('Network email templates filters', () => {
  it('should be defined in filterPredicatesMatch', () => {
    let hasFilters = false
    emailTemplates.network.forEach(({filters}) => {
      if (filters) {
        expect(filterPredicatesMatch).to.contain.all.keys(filters)
        hasFilters = true
      }
    })
    // If this is false, then this test is useless and can be removed.
    expect(hasFilters).to.be.true
  })

  it('should use all the filters defined by filterPredicatesMatch', () => {
    const usedFilters = {}
    emailTemplates.network.forEach(({filters}) => {
      if (filters) {
        filters.forEach(filter => {
          usedFilters[filter] = true
        })
      }
    })
    expect(usedFilters).to.contain.all.keys(filterPredicatesMatch)
  })
})


describe('Network email templates personalizations', () => {
  it('should be defined in personalizationsPredicates', () => {
    let hasPersonalizations = false
    emailTemplates.network.forEach(({personalizations}) => {
      if (personalizations) {
        personalizations.forEach(personalization => {
          if (personalization in Frustration) {
            return
          }
          expect(personalizationsPredicates).to.contain.all.keys(personalization)
          hasPersonalizations = true
        })
      }
    })
    // If this is false, then this test is useless and can be removed.
    expect(hasPersonalizations).to.be.true
  })

  it('should use all the personalizations defined by personalizationsPredicates', () => {
    const usedPersonalizations = {}
    emailTemplates.network.forEach(({personalizations}) => {
      if (personalizations) {
        personalizations.forEach(personalization => {
          usedPersonalizations[personalization] = true
        })
      }
    })
    expect(usedPersonalizations).to.contain.all.keys(personalizationsPredicates)
  })
})


describe('When we can tutoie people', () => {
  it('should not be by default', () => {
    const user = {}
    expect(youForUser(user)('tu', 'vous')).to.equal('vous')
  })

  it('should only be when user asked for it', () => {
    const tutoyableUser = {profile: {canTutoie: true}}
    const notTutoyableUser = {profile: {canTutoie: false}}
    expect(youForUser(tutoyableUser)('tu', 'vous')).to.equal('tu')
    expect(youForUser(notTutoyableUser)('tu', 'vous')).to.equal('vous')
  })
})

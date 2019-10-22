import {expect} from 'chai'
// @ts-ignore
import {FamilySituation, Frustration, UserOrigin} from 'api/user'
import {getUserFrustrationTags, getFamilySituationOptions, increaseRevision,
  getHighestDegreeDescription, ORIGIN_OPTIONS, keepMostRecentRevision,
  isEmailTemplatePersonalized, projectMatchAllFilters, filterPredicatesMatch,
  personalizationsPredicates, youForUser, getJobSearchLengthMonths} from 'store/user'
import emailTemplates from 'components/advisor/data/email_templates.json'


describe('frustrations', (): void => {
  it('should not return any frustrations if unknown', (): void => {
    const profile = {frustrations: ['UNKNOWN_JOB_SEARCH_FRUSTRATION']} as const
    const result = getUserFrustrationTags(profile)
    expect(result.length).to.equal(0)
  })

  it('should return the good number of frustrations for the most important ones', (): void => {
    const profile = {frustrations: [
      'NO_OFFERS', 'NO_OFFER_ANSWERS', 'MOTIVATION', 'TRAINING']} as const
    const result = getUserFrustrationTags(profile)
    expect(result.length).to.equal(4)
  })

  it('should not return any frustrations if frustrations undefined', (): void => {
    const profile = {}
    const result = getUserFrustrationTags(profile)
    expect(result.length).to.equal(0)
  })
})


describe('email personalization', (): void => {
  it('should return true for personalization matching frustrations', (): void => {
    const profile = {frustrations: ['UNKNOWN_JOB_SEARCH_FRUSTRATION']} as const
    const personalizations = ['UNKNOWN_JOB_SEARCH_FRUSTRATION'] as const
    const result = isEmailTemplatePersonalized(personalizations, profile, {})
    expect(result).to.be.true
  })

  it('should return false if personalization is not a frustrations and nothing else', (): void => {
    const profile = {frustrations: ['UNKNOWN_JOB_SEARCH_FRUSTRATION']} as const
    const personalizations = ['UNKNOWN_JOB_SEARCH_FRUSTRATION_2'] as const
    const result = isEmailTemplatePersonalized(personalizations, profile, {})
    expect(result).to.be.false
  })

  it('should return true for graduates', (): void => {
    const profile = {highestDegree: 'LICENCE_MAITRISE'} as const
    const personalizations = ['GRADUATE', 'WHATEVER'] as const
    const result = isEmailTemplatePersonalized(personalizations, profile, {})
    expect(result).to.be.true
  })

  it('should return true for adequate network', (): void => {
    const profile = {}
    const project = {networkEstimate: 3}
    const personalizations = ['NETWORK_SCORE_3']
    const result = isEmailTemplatePersonalized(personalizations, profile, project)
    expect(result).to.be.true
  })

  it('should return false for the same job personalization if the user has not done it',
    (): void => {
      const profile = {}
      const project = {previousJobSimilarity: 'NEVER_DONE'} as const
      const personalizations = ['SAME_JOB']
      const result = isEmailTemplatePersonalized(personalizations, profile, project)
      expect(result).to.be.false
    })
})


describe('projectMatchAllFilters', (): void => {
  it('should match if there are no filters', (): void => {
    const filters = []
    const project = {seniority: 'UNKNOWN'} as const
    // @ts-ignore We want to force the type to see what happens with an unknown value.
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.true
  })

  it('should not match for juniors with for-experienced(2)', (): void => {
    const filters = ['for-experienced(2)']
    const project = {seniority: 'JUNIOR'} as const
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.false
  })

  it('should match intermediary with for-experienced(2)', (): void => {
    const filters = ['for-experienced(2)']
    const project = {seniority: 'INTERMEDIARY'} as const
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.true
  })

  it('should not match intermediary with for-experienced(6)', (): void => {
    const filters = ['for-experienced(6)']
    const project = {seniority: 'INTERMEDIARY'} as const
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.false
  })

  it('should match intermediary with for-experienced(6)', (): void => {
    const filters = ['for-experienced(6)']
    const project = {seniority: 'SENIOR'} as const
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.true
  })
})


describe('getHighestDegreeDescription', (): void => {
  it('should not return any description if there is no degree', (): void => {
    const profile = {highestDegree: 'NO_DEGREE'} as const
    expect(getHighestDegreeDescription(profile)).undefined
  })

  it('should not return any description if there is an unknown degree', (): void => {
    const profile = {highestDegree: 'random'}
    // @ts-ignore We want to force the type to see what happens with an unknown value.
    expect(getHighestDegreeDescription(profile)).undefined
  })

  it('should return the right degree', (): void => {
    const profile = {highestDegree: 'DEA_DESS_MASTER_PHD'} as const
    expect(getHighestDegreeDescription(profile)).to.equal('DEA - DESS - Master - PhD')
  })
})


describe('getFamilySituationOptions', (): void => {
  const familySituations = getFamilySituationOptions()
  familySituations.forEach((situation): void => {
    it(`"${situation.name}" should have correct values`, (): void => {
      expect(situation).to.contain.all.keys('name', 'value')
      const {name, value} = situation
      expect(name).to.be.ok
      expect(value).to.be.ok
      expect(FamilySituation).to.contain.keys(value)
    })
  })
})


describe('ORIGIN_OPTIONS', (): void => {
  ORIGIN_OPTIONS.forEach((option): void => {
    it(`"${option.name}" should have correct values`, (): void => {
      expect(option).to.contain.all.keys('name', 'value')
      const {name, value} = option
      expect(name).to.be.ok
      expect(value).to.be.ok
      expect(UserOrigin).to.contain.keys(value)
    })
  })
})


describe('increaseRevision', (): void => {
  it('should start at 1 when there are no revisions yet', (): void => {
    const modifiedUser = increaseRevision({})
    expect(modifiedUser.revision).to.eq(1)
  })

  it('should increase the revision number', (): void => {
    const modifiedUser = increaseRevision({revision: 4})
    expect(modifiedUser.revision).to.eq(5)
  })

  it('should not modify other fields', (): void => {
    const modifiedUser = increaseRevision({googleId: 'yep', revision: 5})
    expect(modifiedUser.googleId).to.eq('yep')
  })
})


describe('keepMostRecentRevision', (): void => {
  it('should return the server version if a revision is missing', (): void => {
    const user = keepMostRecentRevision(
      {origin: {source: 'client'}}, {origin: {source: 'server'}})
    expect(user.origin && user.origin.source).to.eq('server')
  })

  it('should return the server version if it has new data', (): void => {
    const user = keepMostRecentRevision(
      {origin: {source: 'client'}, revision: 1},
      {origin: {source: 'server'}, revision: 2})
    expect(user.origin && user.origin.source).to.eq('server')
  })

  it('should keep the client version if it has newer data', (): void => {
    const user = keepMostRecentRevision(
      {origin: {source: 'client'}, revision: 3},
      {origin: {source: 'server'}, revision: 2})
    expect(user.origin && user.origin.source).to.eq('client')
  })

  it('should keep the client version if the server data is equal', (): void => {
    const user = keepMostRecentRevision(
      {origin: {source: 'client'}, revision: 2},
      {origin: {source: 'server'}, revision: 2})
    expect(user.origin && user.origin.source).to.eq('client')
  })
})


describe('Network email templates filters', (): void => {
  it('should be defined in filterPredicatesMatch', (): void => {
    let hasFilters = false
    emailTemplates.network.forEach(({filters}): void => {
      if (filters) {
        expect(filterPredicatesMatch).to.contain.all.keys(filters)
        hasFilters = true
      }
    })
    // If this is false, then this test is useless and can be removed.
    expect(hasFilters).to.be.true
  })

  it('should use all the filters defined by filterPredicatesMatch', (): void => {
    const usedFilters = {}
    emailTemplates.network.forEach(({filters}): void => {
      if (filters) {
        filters.forEach((filter): void => {
          usedFilters[filter] = true
        })
      }
    })
    expect(usedFilters).to.contain.all.keys(filterPredicatesMatch)
  })
})


describe('Network email templates personalizations', (): void => {
  it('should be defined in personalizationsPredicates', (): void => {
    let hasPersonalizations = false
    emailTemplates.network.forEach(({personalizations}): void => {
      if (personalizations) {
        personalizations.forEach((personalization): void => {
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

  it('should use all the personalizations defined by personalizationsPredicates', (): void => {
    const usedPersonalizations = {}
    emailTemplates.network.forEach(({personalizations}): void => {
      if (personalizations) {
        personalizations.forEach((personalization): void => {
          usedPersonalizations[personalization] = true
        })
      }
    })
    expect(usedPersonalizations).to.contain.all.keys(personalizationsPredicates)
  })
})


describe('When we can tutoie people', (): void => {
  it('should not be by default', (): void => {
    const user = {}
    expect(youForUser(user)('tu', 'vous')).to.equal('vous')
  })

  it('should only be when user asked for it', (): void => {
    const tutoyableUser = {profile: {canTutoie: true}}
    const notTutoyableUser = {profile: {canTutoie: false}}
    expect(youForUser(tutoyableUser)('tu', 'vous')).to.equal('tu')
    expect(youForUser(notTutoyableUser)('tu', 'vous')).to.equal('vous')
  })
})


const dateNowStub = ((): number => 1568709243361)


describe('getJobSearchLengthMonths', (): void => {
  it('should default to old design for old users', (): void => {
    const project = {
      jobSearchHasNotStarted: false, jobSearchLengthMonths: 3, jobSearchStartedAt: ''}
    expect(getJobSearchLengthMonths(project)).to.equal(3)
  })
  it('should compute the correct search lenght', (): void => {
    const project = {jobSearchHasNotStarted: false, jobSearchStartedAt: '2019-05-17'}
    // Mocking the date.
    const realDateNow = Date.now.bind(global.Date)

    global.Date.now = dateNowStub

    expect(getJobSearchLengthMonths(project)).to.equal(4)
    // Put back the date.
    global.Date.now = realDateNow
  })
})

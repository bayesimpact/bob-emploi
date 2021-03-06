import {expect} from 'chai'
import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'

// @ts-ignore
import {FamilySituation, Frustration, UserOrigin} from 'api/user'
import {getUserFrustrationTags, FAMILY_SITUATION_OPTIONS, increaseRevision, addProjectIds,
  getHighestDegreeDescription, ORIGIN_OPTIONS, keepMostRecentRevision,
  isEmailTemplatePersonalized, projectMatchAllFilters, filterPredicatesMatch,
  personalizationsPredicates, getJobSearchLengthMonths, getUserLocale,
  useUserExample} from 'store/user'
import emailTemplates from 'components/advisor/data/email_templates.json'


const fakeT = (string: string) => string


describe('frustrations', (): void => {
  it('should not return any frustrations if unknown', (): void => {
    const profile = {frustrations: ['UNKNOWN_JOB_SEARCH_FRUSTRATION']} as const
    const result = getUserFrustrationTags(profile, fakeT)
    expect(result.length).to.equal(0)
  })

  it('should return the good number of frustrations for the most important ones', (): void => {
    const profile = {frustrations: [
      'NO_OFFERS', 'NO_OFFER_ANSWERS', 'MOTIVATION', 'TRAINING']} as const
    const result = getUserFrustrationTags(profile, fakeT)
    expect(result.length).to.equal(4)
  })

  it('should not return any frustrations if frustrations undefined', (): void => {
    const profile = {}
    const result = getUserFrustrationTags(profile, fakeT)
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
    const profile = {} as const
    const project = {networkEstimate: 3}
    const personalizations = ['NETWORK_SCORE_3'] as const
    const result = isEmailTemplatePersonalized(personalizations, profile, project)
    expect(result).to.be.true
  })

  it('should return false for the same job personalization if the user has not done it',
    (): void => {
      const profile = {} as const
      const project = {previousJobSimilarity: 'NEVER_DONE'} as const
      const personalizations = ['SAME_JOB'] as const
      const result = isEmailTemplatePersonalized(personalizations, profile, project)
      expect(result).to.be.false
    })
})


describe('projectMatchAllFilters', (): void => {
  it('should match if there are no filters', (): void => {
    const filters = [] as const
    const project = {seniority: 'UNKNOWN'} as const
    // @ts-ignore We want to force the type to see what happens with an unknown value.
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.true
  })

  it('should not match for juniors with for-experienced(2)', (): void => {
    const filters = ['for-experienced(2)'] as const
    const project = {seniority: 'JUNIOR'} as const
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.false
  })

  it('should match intermediary with for-experienced(2)', (): void => {
    const filters = ['for-experienced(2)'] as const
    const project = {seniority: 'INTERMEDIARY'} as const
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.true
  })

  it('should not match intermediary with for-experienced(6)', (): void => {
    const filters = ['for-experienced(6)'] as const
    const project = {seniority: 'INTERMEDIARY'} as const
    const result = projectMatchAllFilters(project, filters)
    expect(result).to.be.false
  })

  it('should match intermediary with for-experienced(6)', (): void => {
    const filters = ['for-experienced(6)'] as const
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
    expect(getHighestDegreeDescription(profile)?.[0]).to.equal('DEA - DESS - Master - PhD')
  })
})


describe('FAMILY_SITUATION_OPTIONS', (): void => {
  const familySituations = FAMILY_SITUATION_OPTIONS
  for (const situation of familySituations) {
    it(`"${situation.name}" should have correct values`, (): void => {
      const {name, value} = situation
      expect(name).to.be.ok
      expect(value).to.be.ok
      expect(FamilySituation).to.contain.keys(value)
    })
  }
})


describe('ORIGIN_OPTIONS', (): void => {
  for (const option of ORIGIN_OPTIONS) {
    it(`"${option.name}" should have correct values`, (): void => {
      expect(option).to.contain.all.keys('name', 'value')
      const {name, value} = option
      expect(name).to.be.ok
      expect(value).to.be.ok
      expect(UserOrigin).to.contain.keys(value)
    })
  }
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
    for (const {filters} of emailTemplates.network) {
      if (filters) {
        expect(filterPredicatesMatch).to.contain.all.keys(filters)
        hasFilters = true
      }
    }
    // If this is false, then this test is useless and can be removed.
    expect(hasFilters).to.be.true
  })

  it('should use all the filters defined by filterPredicatesMatch', (): void => {
    const usedFilters: {[filter: string]: true} = {}
    for (const {filters} of emailTemplates.network) {
      if (filters) {
        for (const filter of filters) {
          usedFilters[filter] = true
        }
      }
    }
    expect(usedFilters).to.contain.all.keys(filterPredicatesMatch)
  })
})


describe('Network email templates personalizations', (): void => {
  it('should be defined in personalizationsPredicates', (): void => {
    let hasPersonalizations = false
    for (const {personalizations} of emailTemplates.network) {
      if (personalizations) {
        for (const personalization of personalizations) {
          if (personalization in Frustration) {
            return
          }
          expect(personalizationsPredicates).to.contain.all.keys(personalization)
          hasPersonalizations = true
        }
      }
    }
    // If this is false, then this test is useless and can be removed.
    expect(hasPersonalizations).to.be.true
  })

  it('should use all the personalizations defined by personalizationsPredicates', (): void => {
    const usedPersonalizations: {[personalization: string]: true} = {}
    for (const {personalizations} of emailTemplates.network) {
      if (personalizations) {
        for (const personalization of personalizations) {
          usedPersonalizations[personalization] = true
        }
      }
    }
    expect(usedPersonalizations).to.contain.all.keys(personalizationsPredicates)
  })
})


// 2019-09-17T08:34:03.361Z
const dateNowStub = ((): number => 1_568_709_243_361)


describe('getJobSearchLengthMonths', (): void => {
  const realDateNow = Date.now.bind(global.Date)
  before((): void => {
    // Mocking the date.
    global.Date.now = dateNowStub
  })
  after((): void => {
    // Put back the date.
    global.Date.now = realDateNow
  })
  it('should compute the correct search length', (): void => {
    const project = {jobSearchHasNotStarted: false, jobSearchStartedAt: '2019-05-17'}
    expect(getJobSearchLengthMonths(project)).to.equal(4)
  })
  it('should ignore an empty createdAt field', (): void => {
    const project = {createdAt: '', jobSearchHasNotStarted: false, jobSearchStartedAt: '2019-05-17'}
    expect(getJobSearchLengthMonths(project)).to.equal(4)
  })
  it('should use the createdAt field', (): void => {
    const project = {
      createdAt: '2019-12-17',
      jobSearchHasNotStarted: false,
      jobSearchStartedAt: '2019-05-17',
    }
    expect(getJobSearchLengthMonths(project)).to.equal(7)
  })
  it('should return 0 for undefined', (): void => {
    const project = {jobSearchHasNotStarted: false}
    expect(getJobSearchLengthMonths(project)).to.equal(0)
  })
  it('should return -1 for not started', (): void => {
    const project = {jobSearchHasNotStarted: true}
    expect(getJobSearchLengthMonths(project)).to.equal(-1)
  })
})


describe('getUserLocale', (): void => {
  it('should return "fr" by defaut', (): void => {
    const locale = getUserLocale()
    expect(locale).to.equal('fr')
  })

  it("should return the user's locale", (): void => {
    const locale = getUserLocale({locale: 'en'})
    expect(locale).to.equal('en')
  })
})


describe('addProjectIds', (): void => {
  it('should not modify objects already with project IDs', (): void => {
    const emptyUser = {}
    expect(addProjectIds(emptyUser)).to.equal(emptyUser)

    const userWithProjectIds = {projects: [{projectId: '3'}]}
    expect(addProjectIds(userWithProjectIds)).to.equal(userWithProjectIds)
  })

  it('should add an ID to a project without ID', (): void => {
    const user = {projects: [{targetJob: {name: 'Boulanger'}}]}
    const modifiedUser = addProjectIds(user)
    expect(modifiedUser).not.to.equal(user)
    expect(modifiedUser.projects).to.have.lengthOf(1)
    const modifiedProject = modifiedUser!.projects![0]!
    expect(modifiedProject).to.have.all.keys('targetJob', 'projectId')
    expect(modifiedProject.projectId).to.be.ok
  })
})


const Component = (): React.ReactElement => {
  const user = useUserExample()
  return React.createElement('Spy', {user})
}


describe('useUserExample', (): void => {
  it('should return a user example', (): void => {
    const renderer = ShallowRenderer.createRenderer()
    renderer.render(React.createElement(Component, {}))
    const result = renderer.getRenderOutput()

    expect(result.props.user).to.have.all.keys('profile', 'projects')
    expect(result.props.user.profile).to.include.all.keys(
      'coachingEmailFrequency', 'familySituation', 'gender', 'highestDegree', 'yearOfBirth')
    expect(result.props.user.projects).to.have.lengthOf(1)
    expect(result.props.user.projects[0]).to.include.all.keys(
      'areaType', 'city', 'employmentTypes', 'kind', 'seniority', 'targetJob')
  })
})

import {expect} from 'chai'
import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'

// @ts-ignore
import {FamilySituation, UserOrigin} from 'api/user'
import {getUserFrustrationTags, FAMILY_SITUATION_OPTIONS, increaseRevision, addProjectIds,
  getHighestDegreeDescription, ORIGIN_OPTIONS, keepMostRecentRevision,
  getJobSearchLengthMonths, getUserLocale, useUserExample} from 'store/user'


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

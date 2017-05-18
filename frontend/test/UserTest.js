var chai = require('chai')
var expect = chai.expect
import {FamilySituation} from 'api/user'
import {travelInTime, isOldAndDiscriminated, isYoungAndDiscriminated,
  getUserFrustrationTags, getFamilySituationOptions,
  getHighestDegreeDescription} from 'store/user'


describe('age discrimination', () => {
  const thisYear = (new Date()).getFullYear()

  it('should match an old frustrated user', () => {
    const profile = {
      frustrations: ['AGE_DISCRIMINATION'],
      yearOfBirth: 1920,
    }
    expect(isOldAndDiscriminated(profile)).to.be.true
  })

  it('should match a young frustrated user', () => {
    const profile = {
      frustrations: ['AGE_DISCRIMINATION'],
      yearOfBirth: thisYear - 20}
    expect(isYoungAndDiscriminated(profile)).to.be.true
  })

  it('should not match a middle age person', () => {
    const profile = {
      frustrations: ['AGE_DISCRIMINATION'],
      yearOfBirth: thisYear - 35,
    }
    expect(isYoungAndDiscriminated(profile)).to.be.false
    expect(isOldAndDiscriminated(profile)).to.be.false
  })

  it('should not match a non-frustrated user', () => {
    const profile = {
      frustrations: ['PAS_DE_MACHINE_A_CAFE'],
      yearOfBirth: thisYear - 65,
    }
    expect(isOldAndDiscriminated(profile)).to.be.false
  })
})


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


describe('travelInTime', () => {
  it('should add a delta to a date', () => {
    const result = travelInTime('2016-10-14T13:56:37.956Z', 60 * 1000)
    expect(result).to.equal('2016-10-14T13:57:37.956Z')
  })

  it('should add a delta to a date field', () => {
    const user = {
      createdAt: '2016-10-14T13:56:00.956Z',
    }
    const result = travelInTime(user, 42 * 1000)
    expect(result).to.eql({
      createdAt: '2016-10-14T13:56:42.956Z',
    })
  })

  it('should add a delta to all dates in an array', () => {
    const user = [
      '2016-10-14T13:56:00.956Z',
      '2016-10-14T13:57:00.956Z',
      '2016-10-14T13:58:00.956Z',
    ]
    const result = travelInTime(user, 42 * 1000)
    expect(result).to.eql([
      '2016-10-14T13:56:42.956Z',
      '2016-10-14T13:57:42.956Z',
      '2016-10-14T13:58:42.956Z',
    ])
  })

  it('should add a delta to dates embedded in a complex structure', () => {
    const user = {
      createdAt: '2016-10-14T13:56:00.956Z',
      projects: [
        {updatedAt: '2016-10-14T13:57:00.956Z'},
        {updatedAt: '2016-10-14T13:58:00.956Z'},
      ],
    }
    const result = travelInTime(user, 42 * 1000)
    expect(result).to.eql({
      createdAt: '2016-10-14T13:56:42.956Z',
      projects: [
        {updatedAt: '2016-10-14T13:57:42.956Z'},
        {updatedAt: '2016-10-14T13:58:42.956Z'},
      ],
    })
  })

  it('should not modify things that are not timestamps', () => {
    ['simple text', 1234, '1234', new Date(), true].forEach(value => {
      expect(value).to.eql(travelInTime(value, 42 * 1000))
    })
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

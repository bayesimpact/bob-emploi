import {prepareT as prepareTNoExtract} from 'store/i18n'

// 2,635,200,000 = 1000 * 60 * 60 * 24 * 30.5
const MILLIS_IN_MONTH = 2_635_200_000

export const sampleProfile: bayes.bob.UserProfile = {}

export const sampleFrustrations: readonly bayes.bob.Frustration[] = []

export const sampleProject: bayes.bob.Project = {}

export const sampleCities: readonly bayes.bob.FrenchCity[] = [
  // Keep this one first or update the reference in user.ts.
  // TODO(cyrille): Update once cities are used instead of wards.
  {
    cityId: 'E05009148',
    departementId: 'E06000057',
    departementName: 'Northumberland',
    name: 'Rothbury',
    regionId: 'E12000001',
    regionName: 'North East',
  },
] as const

export const sampleJobs = [
  {
    codeOgr: 'e80d832c',
    jobGroup: {
      name: prepareTNoExtract('Other administrative occupations n.e.c.'),
      romeId: '4159',
    },
    name: prepareTNoExtract('Admin assistant'),
  },
] as const

export const sampleUsersPerDiagnostic = {
  'bravo': {
    projects: [{
      city: sampleCities[0],
      jobSearchStartedAt: new Date(Date.now() - MILLIS_IN_MONTH * 3).toISOString(),
      passionateLevel: 'LIFE_GOAL_JOB',
      targetJob: sampleJobs[0],
      totalInterviewCount: 12,
      trainingFulfillmentEstimate: 'ENOUGH_DIPLOMAS',
      weeklyOffersEstimate: 'DECENT_AMOUNT',
    }],
  },
  'enhance-methods-to-interview': {
    projects: [{
      city: sampleCities[0],
      jobSearchStartedAt: new Date(Date.now() - MILLIS_IN_MONTH * 3).toISOString(),
      passionateLevel: 'LIFE_GOAL_JOB',
      targetJob: sampleJobs[0],
      totalInterviewCount: 1,
      trainingFulfillmentEstimate: 'ENOUGH_DIPLOMAS',
      weeklyApplicationsEstimate: 'SOME',
      weeklyOffersEstimate: 'DECENT_AMOUNT',
    }],
  },
  'missing-diploma': {
    projects: [{
      city: sampleCities[0],
      passionateLevel: 'LIFE_GOAL_JOB',
      targetJob: sampleJobs[0],
      trainingFulfillmentEstimate: 'TRAINING_FULFILLMENT_NOT_SURE',
    }],
  },
  'start-your-search': {
    projects: [{
      city: sampleCities[0],
      jobSearchHasNotStarted: true,
      passionateLevel: 'LIFE_GOAL_JOB',
      targetJob: sampleJobs[0],
      trainingFulfillmentEstimate: 'ENOUGH_DIPLOMAS',
    }],
  },
  'stuck-market': {
    projects: [{
      city: sampleCities[0],
      targetJob: sampleJobs[0],
    }],
  },
  'undefined-project': {
    projects: [{
      hasClearProject: 'FALSE',
      targetJob: undefined,
    }],
  },
} as const

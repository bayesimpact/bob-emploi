import type {LocalizableString} from 'store/i18n'
import {prepareT as prepareTNoExtract} from 'store/i18n'

// 2,635,200,000 = 1000 * 60 * 60 * 24 * 30.5
const MILLIS_IN_MONTH = 2_635_200_000

export const sampleProfile: bayes.bob.UserProfile = {
  familySituation: 'IN_A_RELATIONSHIP',
  highestDegree: 'BTS_DUT_DEUG',
  yearOfBirth: 1985,
}

export const sampleFrustrations: readonly bayes.bob.Frustration[] = ['RESUME']

export const sampleProject: bayes.bob.Project = {
  employmentTypes: ['FULL_TIME_EMPLOYMENT'],
  jobSearchStartedAt: new Date(Date.now() - MILLIS_IN_MONTH * 3).toISOString(),
  networkEstimate: 2,
  previousJobSimilarity: 'DONE_SIMILAR',
  seniority: 'INTERMEDIARY',
}

export const sampleCities: readonly bayes.bob.FrenchCity[] = [
  // Keep this one first or update the reference in user.ts.
  {
    cityId: '5206379',
    departementId: '42003',
    departementName: 'Allegheny County',
    name: 'Pittsburgh',
    population: 304_391,
    regionId: 'PA',
    regionName: 'Pennsylvania',
  },
]

export const sampleJobs: readonly {
  codeOgr: string
  feminineName?: LocalizableString
  jobGroup: {
    name: LocalizableString
    romeId: string
  }
  masculineName?: LocalizableString
  name: LocalizableString
}[] = [
  {
    codeOgr: 'c9f9b01d',
    jobGroup: {
      name: prepareTNoExtract('Transportation, Storage, and Distribution Managers'),
      romeId: '11-3071',
    },
    name: prepareTNoExtract('Warehouse Operations Manager'),
  },
  {
    codeOgr: '9ee4d071',
    jobGroup: {
      name: prepareTNoExtract('First-Line Supervisors of Air Crew Members'),
      romeId: '55-2011',
    },
    name: prepareTNoExtract('Flight Engineer Manager'),
  },
]

export const sampleUsersPerDiagnostic = {
  'bravo': {
    projects: [{
      city: sampleCities[0],
      jobSearchStartedAt: new Date(Date.now() - MILLIS_IN_MONTH * 3).toISOString(),
      passionateLevel: 'LIFE_GOAL_JOB',
      targetJob: sampleJobs[0],
      totalInterviewCount: 12,
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
  'find-what-you-like': {
    profile: {
      yearOfBirth: 2002,
    },
    projects: [{
      city: sampleCities[0],
      passionateLevel: 'ALIMENTARY_JOB',
      targetJob: sampleJobs[1],
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

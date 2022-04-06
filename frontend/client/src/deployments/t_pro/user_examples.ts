import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'

// 2,635,200,000 = 1000 * 60 * 60 * 24 * 30.5
const MILLIS_IN_MONTH = 2_635_200_000

export const sampleProfile: bayes.bob.UserProfile = {}

export const sampleFrustrations: readonly bayes.bob.Frustration[] = []

export const sampleProject: bayes.bob.Project = {}

export const sampleCities: readonly bayes.bob.FrenchCity[] = [
  // Keep this one first or update the reference in user.ts.
  {
    cityId: '69123',
    departementId: '69',
    departementName: 'Rhône',
    departementPrefix: 'dans le ',
    latitude: 45.7589,
    longitude: 4.841_39,
    name: 'Lyon',
    population: 484_344,
    postcodes: '69001-69002-69003-69004-69005-69006-69007-69008-69009',
    regionId: '84',
    regionName: 'Auvergne-Rhône-Alpes',
    urbanScore: 7,
  },
  {
    cityId: '32208',
    departementId: '32',
    departementName: 'Gers',
    departementPrefix: 'dans le ',
    name: 'Lectoure',
    population: 3785,
    postcodes: '32700',
    publicTransportationScore: 5.26,
    regionId: '76',
    regionName: 'Occitanie',
    urbanScore: 1,
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
  // Keep this one first or update the reference in user.ts.
  {
    codeOgr: '19364',
    feminineName: prepareT('Secrétaire'),
    jobGroup: {
      name: prepareT('Secrétariat'),
      romeId: 'M1607',
    },
    masculineName: prepareT('Secrétaire'),
    name: prepareT('Secrétaire'),
  },
  // Keep this one second or update the reference in sampleUsersPerDiagnostic.
  {
    codeOgr: '12688',
    feminineName: prepareT('Coiffeuse'),
    jobGroup: {
      name: prepareT('Coiffure'),
      romeId: 'D1202',
    },
    masculineName: prepareT('Coiffeur'),
    name: prepareT('Coiffeur / Coiffeuse'),
  },
  {
    codeOgr: '11573',
    feminineName: prepareT('Boulangère'),
    jobGroup: {
      name: prepareT('Boulangerie - viennoiserie'),
      romeId: 'D1102',
    },
    masculineName: prepareT('Boulanger'),
    name: prepareT('Boulanger / Boulangère'),
  },
  {
    codeOgr: '16067',
    feminineName: prepareT('Jardinière'),
    jobGroup: {
      name: prepareT('Aménagement et entretien des espaces verts'),
      romeId: 'A1203',
    },
    masculineName: prepareT('Jardinier'),
    name: prepareT('Jardinier / Jardinière'),
  },
] as const


export const sampleUsersPerDiagnostic = {
  'bravo': {
    projects: [{
      city: sampleCities[0],
      jobSearchStartedAt: new Date(Date.now() - MILLIS_IN_MONTH * 3).toISOString(),
      passionateLevel: 'LIFE_GOAL_JOB',
      targetJob: sampleJobs[1],
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
      targetJob: sampleJobs[1],
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
      targetJob: sampleJobs[1],
      trainingFulfillmentEstimate: 'TRAINING_FULFILLMENT_NOT_SURE',
    }],
  },
  'start-your-search': {
    projects: [{
      city: sampleCities[1],
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

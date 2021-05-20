import {prepareT as prepareTNoExtract} from 'store/i18n'

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

import {LocalizableString, prepareT as prepareTNoExtract} from 'store/i18n'

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
    codeOgr: '1a85ae74',
    jobGroup: {
      name: prepareTNoExtract('Janitors and Cleaners, Except Maids and Housekeeping Cleaners'),
      romeId: '37-2011',
    },
    name: prepareTNoExtract('Janitor'),
  },
]

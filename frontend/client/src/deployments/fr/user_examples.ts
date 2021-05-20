import {LocalizableString, prepareT} from 'store/i18n'

export const sampleCities: readonly bayes.bob.FrenchCity[] = [
  // Keep this one first or update the reference in user.ts.
  {
    cityId: '80021',
    departementId: '80',
    departementName: 'Somme',
    departementPrefix: 'dans la ',
    name: 'Amiens',
    population: 133_448,
    postcodes: '80000-80080-80090',
    publicTransportationScore: 5.26,
    regionId: '32',
    regionName: 'Hauts-de-France',
    urbanScore: 6,
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


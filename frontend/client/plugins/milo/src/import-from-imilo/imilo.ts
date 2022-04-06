// Convert Imilo Props to Bob User Props.
import * as Sentry from '@sentry/browser'

import type {CursusPage, ImiloProps, SituationsPage} from './imilo_api'


Sentry.init({
  blacklistUrls: [/portail\.i-milo\.fr/],
  dsn: config.sentryDSN,
})


const imiloToBobMobility = {
  12: 'CITY',
  2: 'DEPARTEMENT',
  9: 'UNKNOWN_AREA_TYPE',
} as const


const imiloToBobGender = {
  // Madame
  1: 'FEMININE',
  // Monsieur
  2: 'MASCULINE',
} as const


const imiloGradeToBobDegree = {
  // Niveau II
  10: 'LICENCE_MAITRISE',
  // Niveau IV
  2: 'BAC_BACPRO',
  // Niveau V bis
  5: 'CAP_BEP',
  // Niveau I
  6: 'DEA_DESS_MASTER_PHD',
  // Niveau V
  8: 'CAP_BEP',
  // Niveau III
  9: 'BTS_DUT_DEUG',
  null: 'NO_DEGREE',
} as const


const imiloDrivingLicenseToBob: {readonly [key: number]: bayes.OptionalBool} = {
  // Pas de permis
  11: 'FALSE',
  // B - Véhic.de - de 10 places
  8: 'TRUE',
} as const


const bobDegreeOrder: readonly bayes.bob.DegreeLevel[] = [
  'DEA_DESS_MASTER_PHD',
  'LICENCE_MAITRISE',
  'BTS_DUT_DEUG',
  'BAC_BACPRO',
  'CAP_BEP',
  'NO_DEGREE',
]


function mapToBob<V>(
  name: string, mapping: {[key: number]: V}, value: number, fullValue: string,
): V {
  const bobValue = mapping[value]
  if (!bobValue) {
    Sentry.withScope(scope => {
      scope.setExtra('fullValue', fullValue)
      scope.setExtra('value', value)
      Sentry.captureMessage(`Unknown value for i-milo -> Bob mapping ${name} "${value}".`)
    })
  }
  return bobValue
}


function getBobHighestDegree(imiloDegrees?: CursusPage): bayes.bob.DegreeLevel|undefined {
  if (!imiloDegrees) {
    return undefined
  }
  const bobDegrees = imiloDegrees.reduce(
    (degrees, {fullAcademicLevel, grade}): {[K in bayes.bob.DegreeLevel]?: true} => ({
      ...degrees,
      [mapToBob('Academic Level', imiloGradeToBobDegree, grade, fullAcademicLevel)]: true,
    }), {} as {[K in bayes.bob.DegreeLevel]?: true})
  const bobHighestDegree = bobDegreeOrder.find((degree): boolean => !!bobDegrees[degree])
  return bobHighestDegree
}


function getBobTargetJob(imiloSituations?: SituationsPage): bayes.bob.Job|undefined {
  if (!imiloSituations) {
    return undefined
  }
  // Returns the most recent prepared or exerced job.
  // This relies on the assumption that the situations are ordered with the most recent first.
  return imiloSituations.map((situation): bayes.bob.Job|undefined => {
    const job = situation.fullPracticedJob || situation.fullPreparedJob
    if (!job) {
      return undefined
    }
    const {code, description} = job
    return {jobGroup: {name: description, romeId: code}}
  }).find((job): job is bayes.bob.Job => !!job)
}

// Convert from '10/01/1990' to 1990.
const parseYearOfBirth = (imiloProps: ImiloProps): number => {
  const year = (imiloProps.Identité?.identity?.birthDate || '//').split('/')[2]
  return year && Number.parseInt(year, 10) || 0
}

function convertImiloPropsToBobProps(imiloProps: ImiloProps): bayes.bob.User {
  // 4 is the ID of the situation "Célibataire".
  const isSingle = imiloProps.Identité?.identity?.situation === 4
  const childrenNumber = imiloProps.Identité?.childrenNumber
  const hasKids = childrenNumber && childrenNumber > 0
  const cityId = imiloProps.Coordonnées?.currentAddress?.fullCity?.codeCommune || ''
  const city = {
    cityId,
    // TODO(florian): Cope for oversea départements (e.g. 976)
    departementId: cityId.slice(0, 2),
    name: imiloProps.Coordonnées?.currentAddress?.fullCity?.description,
    postcodes: imiloProps.Coordonnées?.currentAddress?.zipCode,
  }
  const radiusMobility = imiloProps.Mobilité?.radiusMobility
  const areaType = typeof radiusMobility === 'undefined' ? undefined : mapToBob<bayes.bob.AreaType>(
    'Radius Mobility', imiloToBobMobility, radiusMobility,
    imiloProps.Mobilité?.fullRadiusMobility,
  )
  const civility = imiloProps.Identité?.identity?.civility
  let bobProps: bayes.bob.User = {
    profile: {
      email: imiloProps.Identité?.identity?.email,
      familySituation: isSingle ?
        (hasKids ? 'SINGLE_PARENT_SITUATION' : 'SINGLE') :
        (hasKids ? 'FAMILY_WITH_KIDS' : 'IN_A_RELATIONSHIP'),
      // 2 is the ID of the civility "Monsieur".
      gender: typeof civility === 'undefined' ? undefined : mapToBob<bayes.bob.Gender>(
        'Civility', imiloToBobGender, Number.parseInt(civility, 10),
        imiloProps.Identité?.identity?.fullCivility,
      ),
      highestDegree: getBobHighestDegree(imiloProps.Cursus),
      lastName: imiloProps.Identité?.identity?.lastname,
      name: imiloProps.Identité?.identity?.firstname,
      // TODO(florian): Add FROM_ML_COUNSELOR.
      origin: 'FROM_PE_COUNSELOR',
      yearOfBirth: parseYearOfBirth(imiloProps),
    },
    // TODO(cyrille): Add a `searchStartedAt` field.
    projects: [{
      areaType,
      city,
      createdAt: new Date().toISOString(),
      targetJob: getBobTargetJob(imiloProps.Situations),
    }],
  }
  for (const {type} of imiloProps.Mobilité?.drivingLicenses || []) {
    const hasCarDrivingLicense = imiloDrivingLicenseToBob[type]
    if (hasCarDrivingLicense) {
      bobProps = {
        ...bobProps,
        profile: {
          ...bobProps.profile,
          hasCarDrivingLicense,
        },
      }
    }
  }
  return bobProps
}


export default convertImiloPropsToBobProps

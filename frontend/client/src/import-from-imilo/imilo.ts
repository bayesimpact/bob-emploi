// Convert Imilo Props to Bob User Props.
import * as Sentry from '@sentry/browser'

import {CursusPage, ImiloProps, SituationsPage} from './imilo_api'


Sentry.init({
  blacklistUrls: [/portail\.i-milo\.fr/],
  dsn: config.sentryDSN,
})


type NestedValueGetter =
  (<T>(nestedKeys: string[]) => T|undefined) &
  (<T>(nestedKeys: string[], defaultValue: T) => T)


const NOT_FOUND = {} as const

// Safely get prop value by path in a nested object. If one of the element of the path is not
// present, returns the default value or undefined if none provided.
// Example:
// const props = {a: {b: {c: 1}}}
// createNestedValueGetter(props)(['a', 'b', 'c']) returns 1
// createNestedValueGetter(props)(['a', 'd']) returns undefined
// createNestedValueGetter(props)(['a', 'd'], 2) returns 2
// TODO(cyrille): Strong-type to make sure props has a field of type T at position nestedKeys.
function createNestedValueGetter(props: object): NestedValueGetter {
  function getNestedValue<T>(nestedKeys: string[]): T|undefined
  function getNestedValue<T>(nestedKeys: string[], defaultValue: T): T
  function getNestedValue<T>(nestedKeys: string[], defaultValue?: T): T|undefined {
    const value = nestedKeys.reduce((propsInPath, key): T|object =>
      // @ts-ignore
      propsInPath !== NOT_FOUND && key in propsInPath ? propsInPath[key] : NOT_FOUND, props)
    return value === NOT_FOUND ? defaultValue : value
  }

  return getNestedValue
}


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


const imiloDrivingLicenseToBob = {
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


function mapToBob<V>(name: string, mapping: {[key: number]: V}, value: number, fullValue: V): V {
  if (!mapping[value]) {
    Sentry.withScope(scope => {
      scope.setExtra('fullValue', fullValue)
      scope.setExtra('value', value)
      Sentry.captureMessage(`Unknown value for i-milo -> Bob mapping ${name} "${value}".`)
    })
  }
  return mapping[value]
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
  const jobs = imiloSituations.map((situation): bayes.bob.Job|undefined => {
    const job = situation.fullPracticedJob || situation.fullPreparedJob
    if (!job) {
      return undefined
    }
    const {code, description} = job
    return {jobGroup: {name: description, romeId: code}}
  }).filter((job): job is bayes.bob.Job => !!job)
  // Returns the most recent prepared or exerced job.
  // This relies on the assumption that the situations are ordered with the most recent first.
  return jobs[0]
}

function convertImiloPropsToBobProps(imiloProps: ImiloProps): bayes.bob.User {
  const imilo = createNestedValueGetter(imiloProps)
  // 4 is the ID of the situation "Célibataire".
  const isSingle = imilo<number>(['Identité', 'identity', 'situation']) === 4
  const childrenNumber = imilo<number>(['Identité', 'childrenNumber'])
  const hasKids = childrenNumber && childrenNumber > 0
  const cityId = imilo(['Coordonnées', 'currentAddress', 'fullCity', 'codeCommune'], '')
  const city = {
    cityId,
    // TODO(florian): Cope for oversea départements (e.g. 976)
    departementId: cityId.slice(0, 2),
    name: imilo<string>(['Coordonnées', 'currentAddress', 'fullCity', 'description']),
    postcodes: imilo<string>(['Coordonnées', 'currentAddress', 'zipCode']),
  }
  const radiusMobility = imilo<number>(['Mobilité', 'radiusMobility'])
  const areaType = typeof radiusMobility === 'undefined' ? undefined : mapToBob(
    'Radius Mobility', imiloToBobMobility, radiusMobility,
    imilo(['Mobilité', 'fullRadiusMobility']),
  )
  const civility = imilo<number>(['Identité', 'identity', 'civility'])
  let bobProps: bayes.bob.User = {
    profile: {
      email: imilo(['Identité', 'identity', 'email']),
      familySituation: isSingle ?
        (hasKids ? 'SINGLE_PARENT_SITUATION' : 'SINGLE') :
        (hasKids ? 'FAMILY_WITH_KIDS' : 'IN_A_RELATIONSHIP'),
      // 2 is the ID of the civility "Monsieur".
      gender: typeof civility === 'undefined' ? undefined : mapToBob(
        'Civility', imiloToBobGender, civility,
        imilo(['Identité', 'identity', 'fullCivility']),
      ),
      highestDegree: getBobHighestDegree(imilo(['Cursus'])),
      lastName: imilo(['Identité', 'identity', 'lastname']),
      name: imilo(['Identité', 'identity', 'firstname']),
      // TODO(florian): Add FROM_ML_COUNSELOR.
      origin: 'FROM_PE_COUNSELOR',
      // Convert from '10/01/1990' to 1990.
      yearOfBirth: Number.parseInt(
        (imilo(['Identité', 'identity', 'birthDate'], '//')).split('/')[2], 10),
    },
    // TODO(cyrille): Add a `searchStartedAt` field.
    projects: [{
      areaType,
      city,
      createdAt: new Date().toISOString(),
      targetJob: getBobTargetJob(imilo(['Situations'])),
    }],
  }
  imilo(['Mobilité', 'drivingLicenses'], []).forEach(({type}): void => {
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
  })
  return bobProps
}


export {convertImiloPropsToBobProps, createNestedValueGetter}

// Convert Imilo Props to Bob User Props.
import Raven from 'raven-js'

import {CursusPage, ImiloProps, SituationsPage} from './imilo_api'


Raven.config(config.sentryDSN, {
  'ignoreUrls': [/portail\.i-milo\.fr/],
}).install()


// Safely get prop value by path in a nested object.
// Example:
// const props = {a: {b: {c: 1}}}
// getNestedValue(props, 'a', 'b', 'c') returns 1
// getNestedValue(props, 'a', 'd') returns undefined
// getNestedValue(props, ['a', 'b', 'c']) returns 1
// getNestedValue(props, ['a', 'd'], 2) returns 2
function getNestedValue<T>(props: ImiloProps, nestedKeys: string | string[], defaultValue?: T): T {
  let keys: readonly string[]
  if (typeof nestedKeys === 'string') {
    // Converts getNestedValue(props, 'a', 'b', 'c') as getNestedValue(props, ['a', 'b', 'c']).
    keys = Array.prototype.slice.call(arguments, 1)
    defaultValue = undefined
  } else {
    keys = nestedKeys
  }
  const notFound = {}
  const value = keys.reduce((propsInPath, key): T|ImiloProps =>
    propsInPath !== notFound && key in propsInPath ? propsInPath[key] : notFound, props) as T
  return value === notFound ? defaultValue : value
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
    Raven.captureMessage(
      `Unknown value for i-milo -> Bob mapping ${name} "${value}".`,
      {extra: {
        fullValue,
        value,
      }},
    )
  }
  return mapping[value]
}


function getBobHighestDegree(imiloDegrees: CursusPage): bayes.bob.DegreeLevel {
  const bobDegrees = imiloDegrees.reduce(
    (degrees, {fullAcademicLevel, grade}): {[grade: string]: bayes.bob.DegreeLevel} => ({
      ...degrees,
      [mapToBob('Academic Level', imiloGradeToBobDegree, grade, fullAcademicLevel)]: true,
    }), {})
  const bobHighestDegree = bobDegreeOrder.find((degree): boolean => !!bobDegrees[degree])
  return bobHighestDegree
}


function getBobTargetJob(imiloSituations: SituationsPage): bayes.bob.Job {
  const jobs = imiloSituations.map((situation): bayes.bob.Job|null => {
    const job = situation.fullPracticedJob || situation.fullPreparedJob
    if (!job) {
      return null
    }
    const {code, description} = job
    return {jobGroup: {name: description, romeId: code}}
  }).filter((job): boolean => !!job)
  // Returns the most recent prepared or exerced job.
  // This relies on the assumption that the situations are ordered with the most recent first.
  return jobs[0]
}

function convertImiloPropsToBobProps(imiloProps: ImiloProps): bayes.bob.User {
  const imilo = getNestedValue.bind(this, imiloProps)
  // 4 is the ID of the situation "Célibataire".
  const isSingle = imilo('Identité', 'identity', 'situation') === 4
  const hasKids = imilo('Identité', 'childrenNumber') > 0
  const cityId = imilo(['Coordonnées', 'currentAddress', 'fullCity', 'codeCommune'], '')
  const city = {
    cityId,
    // TODO(florian): Cope for oversea départements (e.g. 976)
    departementId: cityId.substring(0, 2),
    name: imilo('Coordonnées', 'currentAddress', 'fullCity', 'description'),
    postcodes: imilo('Coordonnées', 'currentAddress', 'zipCode'),
  }
  const areaType = mapToBob(
    'Radius Mobility', imiloToBobMobility, imilo('Mobilité', 'radiusMobility'),
    imilo('Mobilité', 'fullRadiusMobility'),
  )
  let bobProps: bayes.bob.User = {
    profile: {
      email: imilo('Identité', 'identity', 'email'),
      familySituation: isSingle ?
        (hasKids ? 'SINGLE_PARENT_SITUATION' : 'SINGLE') :
        (hasKids ? 'FAMILY_WITH_KIDS' : 'IN_A_RELATIONSHIP'),
      // 2 is the ID of the civility "Monsieur".
      gender: mapToBob(
        'Civility', imiloToBobGender, imilo('Identité', 'identity', 'civility'),
        imilo('Identité', 'identity', 'fullCivility'),
      ),
      highestDegree: getBobHighestDegree(imilo('Cursus')),
      lastName: imilo('Identité', 'identity', 'lastname'),
      name: imilo('Identité', 'identity', 'firstname'),
      // TODO(florian): Add FROM_ML_COUNSELOR.
      origin: 'FROM_PE_COUNSELOR',
      // Convert from '10/01/1990' to 1990.
      yearOfBirth: parseInt((imilo(['Identité', 'identity', 'birthDate'], '//')).split('/')[2], 10),
    },
    // TODO(cyrille): Add a `searchStartedAt` field.
    projects: [{
      areaType,
      city,
      createdAt: new Date().toISOString(),
      targetJob: getBobTargetJob(imilo('Situations')),
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


export {convertImiloPropsToBobProps, getNestedValue}

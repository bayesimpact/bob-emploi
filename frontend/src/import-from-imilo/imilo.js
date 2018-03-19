// Convert Imilo Props to Bob User Props.


// Safely get prop value by path in a nested object.
// Example:
// const props = {a: {b: {c: 1}}}
// getNestedValue(props, 'a', 'b', 'c') returns 1
// getNestedValue(props, 'a', 'd') returns undefined
// getNestedValue(props, ['a', 'b', 'c']) returns 1
// getNestedValue(props, ['a', 'd'], 2) returns 2
function getNestedValue(props, nestedKeys, defaultValue) {
  if (typeof nestedKeys === 'string') {
    // Converts getNestedValue(props, 'a', 'b', 'c') as getNestedValue(props, ['a', 'b', 'c']).
    nestedKeys = Array.prototype.slice.call(arguments, 1)
    defaultValue = undefined
  }
  const notFound = {}
  const value = nestedKeys.reduce((propsInPath, key) =>
    propsInPath !== notFound && key in propsInPath ? propsInPath[key] : notFound, props)
  return value === notFound ? defaultValue : value
}


// TODO(florian): Verify how the mobility options are named in imilo.
// I am sure only for 'Département'.
const imiloToBobMobility = {
  'Département': 'DEPARTEMENT',
  'France': 'COUNTRY',
  'Monde': 'WORLD',
  'Région': 'REGION',
  'Ville': 'CITY',
}


const imiloLevelToBobDegree = {
  'I': 'DEA_DESS_MASTER_PHD',
  'II': 'LICENCE_MAITRISE',
  'III': 'BTS_DUT_DEUG',
  'IV': 'BAC_BACPRO',
  'V': 'CAP_BEP',
  null: 'NO_DEGREE',
}


function getBobHighestDegree(imiloDegrees) {
  const imiloLevels = imiloDegrees.map(function(degree) {
    const match = (degree['Niveau certification'] || '').match(/Niveau (\w+)/)
    return match && match[1]
  }).filter(imiloLevel => imiloLevel).sort()
  // This relies on the fact that 'I', 'II', 'III', 'IV' and 'V' are sorted in this order both
  // as string and as their corresponding number.
  const imiloHighestLevel = imiloLevels && imiloLevels[0]
  const bobHighestDegree = imiloLevelToBobDegree[imiloHighestLevel]
  return bobHighestDegree
}

function getBobTargetJob(imiloSituations) {
  const jobs = imiloSituations.map(situation => {
    const jobString = situation['Métier préparé'] || situation['Métier exercé']
    if (!jobString) {
      return null
    }
    // Match 'G1101 Accueil touristique' => 'G1101', 'Accueil touristique'.
    const [romeId, name] = jobString.match(/^(\w+) (.*)$/).slice(1)
    return {jobGroup: {name, romeId}}
  }).filter(job => !!job)
  // Returns the most recent prepared or exerced job.
  // This relies on the assumption that the situations are ordered with the most recent first.
  return jobs[0]
}

function convertImiloPropsToBobProps(imiloProps) {
  const imilo = getNestedValue.bind(this, imiloProps)
  const isSingle = imilo('Identité', 'Situation familiale') === 'Célibataire'
  const hasKids = imilo('Identité', 'Enfants à charge') > 0
  const city = {
    // TODO(florian): Cope for oversea départements (e.g. 976)
    departementId: imilo(['Coordonnées', 'Code postal'], '').substring(0, 2),
    name: imilo('Coordonnées', 'Commune'),
    postcodes: imilo('Coordonnées', 'Code postal'),
  }
  const bobProps = {
    profile: {
      email: imilo('Coordonnées', 'E-mail'),
      familySituation: isSingle ?
        (hasKids ? 'SINGLE_PARENT_SITUATION' : 'SINGLE') :
        (hasKids ? 'FAMILY_WITH_KIDS' : 'IN_A_RELATIONSHIP'),
      gender: imilo('Identité', 'Civilité') === 'Monsieur' ? 'MASCULINE' : 'FEMININE',
      highestDegree: getBobHighestDegree(imilo('Cursus')),
      lastName: imilo('Identité', "Nom d'usage"),
      name: imilo('Identité', 'Prénom'),
      // TODO(florian): Add FROM_ML_COUNSELOR.
      origin: 'FROM_PE_COUNSELOR',
      // Convert from '10/01/1990' to 1990.
      yearOfBirth: parseInt((imilo(['Identité', 'Date de naissance'], '//')).split('/')[2], 10),
    },
    projects: [{
      mobility: {
        areaType: imiloToBobMobility[imilo('Mobilité', 'Rayon de mobilité')],
        city: city,
      },
      targetJob: getBobTargetJob(imilo('Situations')),
    }],
  }
  return bobProps
}


export {convertImiloPropsToBobProps, getNestedValue}

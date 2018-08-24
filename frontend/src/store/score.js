import _keyBy from 'lodash/keyBy'


// We cannot use an object, because order matter.
// TODO(cyrille): Move this to somewhere else, since it's not just used for scoring.
const BOB_SUB_METRICS = [
  {
    shortTitle: 'Profil',
    title: userYou => userYou('Ton profil', 'Votre profil'),
    topic: 'PROFILE_DIAGNOSTIC',
  },
  {
    shortTitle: 'Projet',
    title: userYou => userYou('Ton projet', 'Votre projet'),
    topic: 'PROJECT_DIAGNOSTIC',
  },
  {
    shortTitle: 'Méthode',
    title: userYou => userYou("Ta recherche d'emploi", "Votre recherche d'emploi"),
    topic: 'JOB_SEARCH_DIAGNOSTIC',
  },
  {
    shortTitle: 'Marché',
    title: userYou => userYou('Ton marché', 'Votre marché'),
    topic: 'MARKET_DIAGNOSTIC',
  },
  {
    shortTitle: 'Évolution',
    title: userYou => userYou("L'avenir de ton métier", "L'avenir de votre métier"),
    topic: 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
  },
]


// TODO(cyrille): Move with BOB_SUB_METRICS.
const colorFromPercent = percent =>
  percent >= 60 ? colors.GREENISH_TEAL : percent >= 40 ? colors.SQUASH : colors.RED_PINK


const NOT_ENOUGH_DATA = "Nous n'avons pas assez d'informations pour vous aider sur ce point."


function computeBobScore(diagnosticData, userName, userYou) {
  if (!userYou) {
    userYou = (tu, vous) => vous
  }
  const subDiagnostics = _keyBy(diagnosticData.subDiagnostics || [], 'topic')
  const components = BOB_SUB_METRICS.map(subMetric => {
    // We assume here that we either have both or neither of those two properties.
    const isDefined = subMetric.topic in subDiagnostics
    const {score, text} = subDiagnostics[subMetric.topic] || {}
    return {
      ...subMetric,
      isDefined,
      percent: isDefined ? Math.max(10, Math.min(score || 0, 90)) : 0,
      text: text || NOT_ENOUGH_DATA,
    }
  })

  const percent = Math.max(10, Math.min(90, diagnosticData.overallScore || 0))
  const color = colorFromPercent(percent)
  const capitalize = string => string.charAt(0).toUpperCase() + string.slice(1)
  const maybeWithName = sentence => userName ? `${userName}, ${sentence}` : capitalize(sentence)
  const adjective = percent < 40 ? 'difficile' :
    percent < 60 ? 'audacieux' : 'réaliste'
  const title = maybeWithName(
    `${userYou('ton', 'votre')} objectif est ${adjective}${percent >= 40 ? '\u00A0!' : ''}`)
  return {adjective, color, components, percent, title}
}


export {colorFromPercent, computeBobScore, BOB_SUB_METRICS}

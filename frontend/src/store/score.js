import _keyBy from 'lodash/keyBy'

import {Colors} from 'components/theme'


// We cannot use an object, because order matter.
// TODO(cyrille): Move this to somewhere else, since it's not just used for scoring.
const BOB_SUB_METRICS = [
  {
    title: userYou => userYou('Ton profil', 'Votre profil'),
    topic: 'PROFILE_DIAGNOSTIC',
  },
  {
    title: userYou => userYou('Ton projet', 'Votre projet'),
    topic: 'PROJECT_DIAGNOSTIC',
  },
  {
    title: userYou => userYou("Ta recherche d'emploi", "Votre recherche d'emploi"),
    topic: 'JOB_SEARCH_DIAGNOSTIC',
  },
  {
    title: userYou => userYou('Ton marché', 'Votre marché'),
    topic: 'MARKET_DIAGNOSTIC',
  },
  {
    title: userYou => userYou("L'avenir de ton métier", "L'avenir de votre métier"),
    topic: 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
  },
]


// TODO(cyrille): Move with BOB_SUB_METRICS.
const colorFromPercent = percent =>
  percent >= 60 ? Colors.GREENISH_TEAL : percent >= 40 ? Colors.SQUASH : Colors.RED_PINK


const NOT_ENOUGH_DATA = "Nous n'avons pas assez d'informations pour vous aider sur ce point."


// TODO(cyrille): Rename without the `new`.
function computeNewBobScore(diagnosticData, userName, userYou) {
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
  const capitalize = string => string.charAt(0).toUpperCase() + string.slice(1)
  const maybeWithName = sentence => userName ? `${userName}, ${sentence}` : capitalize(sentence)
  const title = percent < 40 ?
    maybeWithName(`il va falloir ${userYou('te', 'vous')} retrousser les manches !`) :
    percent < 60 ?
      maybeWithName(userYou('ton', 'votre') + ' objectif est audacieux !') :
      maybeWithName(userYou('ton', 'votre') + ' objectif est réaliste !')
  return {components, percent, title}
}


export {colorFromPercent, computeNewBobScore, BOB_SUB_METRICS}

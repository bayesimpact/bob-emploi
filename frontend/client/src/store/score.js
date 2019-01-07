import _keyBy from 'lodash/keyBy'

import {upperFirstLetter} from 'store/french'

import evolIcon from 'images/evol-ico.svg'
import marketIcon from 'images/market-ico.svg'
import methodIcon from 'images/method-ico.svg'
import profileIcon from 'images/profile-ico.svg'
import projectIcon from 'images/project-ico.svg'


// We cannot use an object, because order matter.
// TODO(cyrille): Move this to somewhere else, since it's not just used for scoring.
const BOB_SUB_METRICS = [
  {
    color: colors.BOB_BLUE,
    icon: projectIcon,
    shortTitle: 'Projet',
    title: userYou => userYou('Ton projet', 'Votre projet'),
    topic: 'PROJECT_DIAGNOSTIC',
  },
  {
    color: colors.SQUASH,
    icon: methodIcon,
    shortTitle: 'Méthode',
    title: userYou => userYou("Ta recherche d'emploi", "Votre recherche d'emploi"),
    topic: 'JOB_SEARCH_DIAGNOSTIC',
  },
  {
    color: colors.BRIGHT_TEAL,
    icon: marketIcon,
    shortTitle: 'Marché',
    title: userYou => userYou('Ton marché', 'Votre marché'),
    topic: 'MARKET_DIAGNOSTIC',
  },
  {
    color: colors.CANDY_PINK,
    icon: profileIcon,
    shortTitle: 'Profil',
    title: userYou => userYou('Ton profil', 'Votre profil'),
    topic: 'PROFILE_DIAGNOSTIC',
  },
  {
    color: colors.VIVID_PURPLE,
    icon: evolIcon,
    shortTitle: 'Évolution',
    title: userYou => userYou("L'avenir de ton métier", "L'avenir de votre métier"),
    topic: 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
  },
]


// TODO(cyrille): Move with BOB_SUB_METRICS.
const colorFromPercent = percent =>
  percent >= 60 ? colors.GREENISH_TEAL : percent >= 40 ? colors.SQUASH : colors.RED_PINK


const NOT_ENOUGH_DATA = "Nous n'avons pas assez d'informations pour vous aider sur ce point."


function makeDiagnosticTitle(overallSentence, percent, userName, userYou) {
  if (overallSentence) {
    return {shortTitle: overallSentence}
  }
  const maybeWithName = sentence => userName ? `${userName}, ${sentence}` :
    upperFirstLetter(sentence)
  const adjective = percent < 40 ? 'difficile' :
    percent < 60 ? 'audacieux' : 'réaliste'
  const punctuation = percent < 40 ? '' : '\u00A0!'
  const title = maybeWithName(
    `${userYou('ton', 'votre')} objectif est ${adjective}${punctuation}`)
  const shortTitle = `Objectif **${adjective}**${punctuation}`

  return {shortTitle, title}
}

function computeBobScore({overallScore, overallSentence, subDiagnostics}, userName, userYou) {
  if (!userYou) {
    userYou = (tu, vous) => vous
  }
  const subDiagnosticsByTopic = _keyBy(subDiagnostics || [], 'topic')
  const components = BOB_SUB_METRICS.map(subMetric => {
    const isDefined = subMetric.topic in subDiagnosticsByTopic
    // We assume here that we either have both or neither of those two properties.
    const {observations, score, text} = subDiagnosticsByTopic[subMetric.topic] || {}
    return {
      ...subMetric,
      isDefined,
      observations,
      percent: isDefined ? Math.max(10, Math.min(score || 0, 90)) : 0,
      text: text || NOT_ENOUGH_DATA,
    }
  })

  const percent = Math.max(10, Math.min(90, overallScore || 0))
  const color = colorFromPercent(percent)
  const titleData = makeDiagnosticTitle(overallSentence, percent, userName, userYou)
  return {color, components, percent, ...titleData}
}


export {colorFromPercent, computeBobScore}

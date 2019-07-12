import _keyBy from 'lodash/keyBy'

import {YouChooser, upperFirstLetter} from 'store/french'

import evolIcon from 'images/evol-ico.svg'
import marketIcon from 'images/market-ico.svg'
import methodIcon from 'images/method-ico.svg'
import profileIcon from 'images/profile-ico.svg'
import projectIcon from 'images/project-ico.svg'


interface StaticSubmetric {
  color: string
  icon: string
  shortTitle: string
  title: (userYou: YouChooser) => string
  topic: bayes.bob.DiagnosticTopic
}


// We cannot use an object, because order matter.
// TODO(cyrille): Move this to somewhere else, since it's not just used for scoring.
const BOB_SUB_METRICS: StaticSubmetric[] = [
  {
    color: colors.BOB_BLUE,
    icon: projectIcon,
    shortTitle: 'Projet',
    title: (userYou: YouChooser): string => userYou('Ton projet', 'Votre projet'),
    topic: 'PROJECT_DIAGNOSTIC',
  },
  {
    color: colors.SQUASH,
    icon: methodIcon,
    shortTitle: 'Méthode',
    title: (userYou: YouChooser): string =>
      userYou("Ta recherche d'emploi", "Votre recherche d'emploi"),
    topic: 'JOB_SEARCH_DIAGNOSTIC',
  },
  {
    color: colors.BRIGHT_TEAL,
    icon: marketIcon,
    shortTitle: 'Marché',
    title: (userYou: YouChooser): string => userYou('Ton marché', 'Votre marché'),
    topic: 'MARKET_DIAGNOSTIC',
  },
  {
    color: colors.CANDY_PINK,
    icon: profileIcon,
    shortTitle: 'Profil',
    title: (userYou: YouChooser): string => userYou('Ton profil', 'Votre profil'),
    topic: 'PROFILE_DIAGNOSTIC',
  },
  {
    color: colors.VIVID_PURPLE,
    icon: evolIcon,
    shortTitle: 'Évolution',
    title: (userYou: YouChooser): string =>
      userYou("L'avenir de ton métier", "L'avenir de votre métier"),
    topic: 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
  },
]


// TODO(cyrille): Move with BOB_SUB_METRICS.
const colorFromPercent = (percent: number): string =>
  percent >= 60 ? colors.GREENISH_TEAL : percent >= 40 ? colors.SQUASH : colors.RED_PINK

const impactFromPercentDelta = (percent: number): {color: string; impact: string} => {
// TODO(marielaure): Find a better golden number to switch from improvement score
// to scores for color.
  const color = colorFromPercent(4 * percent)
  return {
    color,
    impact: color === colors.GREENISH_TEAL ? 'fort' : color === colors.SQUASH ? 'moyen' : 'faible',
  }
}


interface DiagnosticTitle {
  shortTitle: string
  title?: string
}


function makeDiagnosticTitle(
  overallSentence: string, percent: number, userName: string,
  userYou: YouChooser): DiagnosticTitle {
  if (overallSentence) {
    return {shortTitle: overallSentence}
  }
  const maybeWithName = (sentence: string): string => userName ? `${userName}, ${sentence}` :
    upperFirstLetter(sentence)
  const adjective = percent < 40 ? 'difficile' :
    percent < 60 ? 'audacieux' : 'réaliste'
  const punctuation = percent < 40 ? '.' : '\u00A0!'
  const title = maybeWithName(
    `${userYou('ton', 'votre')} objectif est ${adjective}${punctuation}`)
  const shortTitle = `Objectif **${adjective}**${punctuation}`

  return {shortTitle, title}
}

export interface ScoreComponent extends bayes.bob.SubDiagnostic {
  isAlwaysExpanded?: boolean
  isDefined: boolean
  isEnticing?: boolean
  percent: number
  color: string
  icon: string
  shortTitle: string
  title: (userYou: YouChooser) => string
}

export interface Score extends DiagnosticTitle {
  color: string
  components: ScoreComponent[]
  percent: number
}

function computeBobScore(
  {overallScore, overallSentence, subDiagnostics}: bayes.bob.Diagnostic,
  userName?: string,
  userYou?: YouChooser): Score {
  if (!userYou) {
    userYou = <T>(tu: T, vous: T): T => vous
  }
  const subDiagnosticsByTopic = _keyBy(subDiagnostics || [], 'topic')
  const notEnoughDataText = "Nous n'avons pas assez d'informations " +
    `pour ${userYou("t'", 'vous ')}aider sur ce point.`
  const components = BOB_SUB_METRICS.map((subMetric): ScoreComponent => {
    const isDefined = subMetric.topic in subDiagnosticsByTopic
    // We assume here that we either have both or neither of those two properties.
    const {observations = [], score = 0, text = notEnoughDataText} =
      subDiagnosticsByTopic[subMetric.topic] || {}
    return {
      ...subMetric,
      isDefined,
      observations,
      percent: isDefined ? Math.max(10, Math.min(score || 0, 90)) : 0,
      text: text || notEnoughDataText,
    }
  })

  const percent = Math.max(10, Math.min(90, overallScore || 0))
  const color = colorFromPercent(percent)
  const titleData = makeDiagnosticTitle(overallSentence, percent, userName || '', userYou)
  return {color, components, percent, ...titleData}
}


export {colorFromPercent, computeBobScore, impactFromPercentDelta}

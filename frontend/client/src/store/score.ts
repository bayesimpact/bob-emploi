import type {TFunction} from 'i18next'

import type {LocalizableString} from 'store/i18n'
import {combineTOptions, prepareT} from 'store/i18n'


const tricotomyScore = <T>(percent: number, low: T, medium: T, high: T): T =>
  percent >= 60 ? high : percent >= 40 ? medium : low

// TODO(cyrille): Move this to somewhere else, since it's not just used for scoring.
const colorFromPercent = (percent: number): string =>
  tricotomyScore(percent, colors.RED_PINK, colors.SQUASH, colors.GREENISH_TEAL)

const impactFromPercentDelta = (percent: number): {color: string; impact: string} => {
// TODO(sil): Find a better golden number to switch from improvement score
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


const titleTemplates: readonly {
  shortTitle: LocalizableString
  threshold: number
  title: LocalizableString
  titleWithName: LocalizableString
}[] = [
  {
    shortTitle: prepareT('Objectif **difficile**.'),
    threshold: 40,
    title: prepareT('Votre objectif est difficile.'),
    titleWithName: prepareT('{{name}}, votre objectif est difficile.'),
  },
  {
    shortTitle: prepareT('Objectif **audacieux**\u00A0!'),
    threshold: 60,
    title: prepareT('Votre objectif est audacieux\u00A0!'),
    titleWithName: prepareT('{{name}}, votre objectif est audacieux\u00A0!'),
  },
  {
    shortTitle: prepareT('Objectif **réaliste**\u00A0!'),
    threshold: 200,
    title: prepareT('Votre objectif est réaliste\u00A0!'),
    titleWithName: prepareT('{{name}}, votre objectif est réaliste\u00A0!'),
  },
] as const


function makeDiagnosticTitle(
  overallSentence: string|undefined, percent: number, userName: string | undefined,
  translate: TFunction): DiagnosticTitle {
  if (overallSentence) {
    return {shortTitle: overallSentence}
  }
  const template = titleTemplates.
    find(({threshold}): boolean => percent < threshold) ||
    titleTemplates[titleTemplates.length - 1]
  const title = userName ?
    translate(...combineTOptions(template.titleWithName, {name: userName})) :
    translate(...template.title)
  const shortTitle = translate(...template.shortTitle)
  return {shortTitle, title}
}

export interface Score extends DiagnosticTitle {
  color: string
  percent: number
}

function computeBobScore(
  {overallScore, overallSentence}: bayes.bob.Diagnostic,
  userName?: string,
  t?: TFunction): Score {
  if (!t) {
    t = (text: string): string => text
  }
  const percent = Math.max(10, Math.min(90, overallScore || 0))
  const color = colorFromPercent(percent)
  const titleData = makeDiagnosticTitle(overallSentence, percent, userName, t)
  return {color, percent, ...titleData}
}


export {colorFromPercent, computeBobScore, impactFromPercentDelta, tricotomyScore}

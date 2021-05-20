import {TFunction} from 'i18next'
import {getAdviceModule} from 'store/i18n'


const MAX_NUMBER_ROCKETS = 5


function getAdviceTitle(advice: bayes.bob.Advice, t: TFunction): string {
  if (advice.title) {
    return advice.title
  }
  if (!advice.adviceId) {
    return ''
  }
  const {adviceId, numStars = -1} = advice
  const {title = '', titleXStars: {[numStars]: starredTitle = ''} = {}} =
    getAdviceModule(adviceId, t)
  return starredTitle || title
}


function getAdviceShortTitle(
  {adviceId, shortTitle: adviceShortTitle}: bayes.bob.Advice, t: TFunction): string {
  if (adviceShortTitle) {
    return adviceShortTitle
  }
  if (!adviceId) {
    return ''
  }
  const {shortTitle = ''} = getAdviceModule(adviceId, t)
  return shortTitle || ''
}

function getAdviceGoal({adviceId, goal: adviceGoal}: bayes.bob.Advice, t: TFunction): string {
  if (adviceGoal) {
    return adviceGoal
  }
  if (!adviceId) {
    return ''
  }
  const {goal = ''} = getAdviceModule(adviceId, t)
  return goal || ''
}

function getRocketFromStars(numStars: number): number {
  if (numStars >= MAX_NUMBER_ROCKETS) {
    return numStars
  }
  return Math.round(numStars * 2 - 1)
}


export type ValidAdvice = bayes.bob.Advice & {adviceId: string}


const isValidAdvice = (a?: bayes.bob.Advice): a is ValidAdvice => !!(a && a.adviceId)


function getAdviceTheme({adviceId}: ValidAdvice, translate: TFunction): string {
  return getAdviceModule(adviceId, translate)?.resourceTheme || ''
}

export {getAdviceShortTitle, getAdviceTitle, getRocketFromStars, MAX_NUMBER_ROCKETS, getAdviceGoal,
  isValidAdvice, getAdviceTheme}

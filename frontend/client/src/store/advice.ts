import {YouChooser, getAdviceModules} from 'store/french'
import _invert from 'lodash/invert'

const topicUrls = {
  'JOB_OF_THE_FUTURE_DIAGNOSTIC': 'futur',
  'JOB_SEARCH_DIAGNOSTIC': 'recherche',
  'MARKET_DIAGNOSTIC': 'marche',
  'PROFILE_DIAGNOSTIC': 'profil',
  'PROJECT_DIAGNOSTIC': 'projet',
}
const urlsToTopic = _invert(topicUrls)


const MAX_NUMBER_ROCKETS = 5


function getAdviceTitle(advice: bayes.bob.Advice, userYou: YouChooser): string {
  if (!userYou) {
    userYou = <T>(tu: T, vous: T): T => vous
  }
  if (advice.title) {
    return advice.title
  }
  if (!advice.adviceId) {
    return ''
  }
  const {adviceId, numStars = -1} = advice
  const {title = '', titleXStars: {[numStars]: starredTitle = ''} = {}} =
    getAdviceModules(userYou)[adviceId] || {}
  return starredTitle || title
}


function getAdviceShortTitle(
  {adviceId, shortTitle: adviceShortTitle}: bayes.bob.Advice, userYou: YouChooser): string {
  if (!userYou) {
    userYou = <T>(tu: T, vous: T): T => vous
  }
  if (adviceShortTitle) {
    return adviceShortTitle
  }
  if (!adviceId) {
    return ''
  }
  const {shortTitle = ''} = getAdviceModules(userYou)[adviceId] || {}
  return shortTitle || ''
}

function getAdviceGoal(
  {adviceId, goal: adviceGoal}: bayes.bob.Advice, userYou: YouChooser): string {
  if (adviceGoal) {
    return adviceGoal
  }
  if (!userYou) {
    userYou = <T>(tu: T, vous: T): T => vous
  }
  if (!adviceId) {
    return ''
  }
  const {goal = ''} = getAdviceModules(userYou)[adviceId] || {}
  return goal || ''
}

function getRocketFromStars(numStars: number): number {
  if (numStars >= MAX_NUMBER_ROCKETS) {
    return numStars
  }
  return Math.round(numStars * 2 - 1)
}


// TODO(cyrille): Clean-out, since unused.
function getTopicUrl(topic: string): string {
  return topicUrls[topic] || ''
}


// TODO(cyrille): Clean-out, since unused.
function getTopicFromUrl(url: string): string {
  return urlsToTopic[url] || ''
}


export type ValidAdvice = bayes.bob.Advice & {adviceId: string}


const isValidAdvice = (a?: bayes.bob.Advice): a is ValidAdvice => !!(a && a.adviceId)


export {getAdviceShortTitle, getAdviceTitle, getRocketFromStars,
  MAX_NUMBER_ROCKETS, getTopicUrl, getTopicFromUrl, getAdviceGoal, isValidAdvice}

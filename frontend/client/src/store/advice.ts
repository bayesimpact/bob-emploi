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
  const {adviceId, numStars} = advice
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
  const {shortTitle = ''} = getAdviceModules(userYou)[adviceId] || {}
  return shortTitle || ''
}

function getAdviceGoal(
  {adviceId, goal: adviceGoal}: bayes.bob.Advice, userYou: YouChooser): string {
  if (!userYou) {
    userYou = <T>(tu: T, vous: T): T => vous
  }
  if (adviceGoal) {
    return adviceGoal
  }
  const {goal = ''} = getAdviceModules(userYou)[adviceId] || {}
  return goal || ''
}

function getRocketFromStars(numStars: number): number {
  if (numStars >= MAX_NUMBER_ROCKETS) {
    return numStars
  }
  return Math.round((numStars || 0) * 2 - 1)
}


// TODO(cyrille): Clean-out, since unused.
function getTopicUrl(topic: string): string {
  return topicUrls[topic] || ''
}


// TODO(cyrille): Clean-out, since unused.
function getTopicFromUrl(url: string): string {
  return urlsToTopic[url] || ''
}


export {getAdviceShortTitle, getAdviceTitle, getRocketFromStars,
  MAX_NUMBER_ROCKETS, getTopicUrl, getTopicFromUrl, getAdviceGoal}

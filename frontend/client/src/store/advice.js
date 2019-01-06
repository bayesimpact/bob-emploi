import {getAdviceModules} from 'store/french'
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

function getAdviceTitle(advice, userYou) {
  if (!userYou) {
    userYou = (tu, vous) => vous
  }
  if (advice.title) {
    return advice.title
  }
  const {adviceId, numStars} = advice
  const {title, titleXStars: {[numStars]: starredTitle}} =
    getAdviceModules(userYou)[adviceId] || {titleXStars: {}}
  return starredTitle || title
}


function getAdviceShortTitle({adviceId, shortTitle: adviceShortTitle}, userYou) {
  if (!userYou) {
    userYou = (tu, vous) => vous
  }
  if (adviceShortTitle) {
    return adviceShortTitle
  }
  const {shortTitle} = getAdviceModules(userYou)[adviceId] || {}
  return shortTitle || ''
}

function getAdviceGoal({adviceId, goal: adviceGoal}, userYou) {
  if (!userYou) {
    userYou = (tu, vous) => vous
  }
  if (adviceGoal) {
    return adviceGoal
  }
  const {goal} = getAdviceModules(userYou)[adviceId] || {}
  return goal || ''
}

function getRocketFromStars(numStars) {
  if (numStars >= MAX_NUMBER_ROCKETS) {
    return numStars
  }
  return Math.round((numStars || 0) * 2 - 1)
}


function getTopicUrl(topic) {
  return topicUrls[topic] || ''
}


function getTopicFromUrl(url) {
  return urlsToTopic[url] || ''
}


export {getAdviceShortTitle, getAdviceTitle, getRocketFromStars,
  MAX_NUMBER_ROCKETS, getTopicUrl, getTopicFromUrl, getAdviceGoal}

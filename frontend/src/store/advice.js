import {getAdviceModules} from 'store/french'

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


export {getAdviceTitle}

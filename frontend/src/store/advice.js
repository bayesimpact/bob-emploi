// TODO(pascal): Move this file to the store.
import adviceModuleProperties from 'components/advisor/data/advice_modules.json'


function isAnyAdviceScored(project) {
  return (project.advices || []).filter(advice => advice.score).length > 0
}


function getAdviceScorePriority(score) {
  return score >= 7 ? 'prioritaire' : score >= 4 ? 'moyennement prioritaire' : 'peu prioritaire'
}


function getAdviceTitle(advice) {
  const {adviceId, numStars} = advice
  const {title, titleXStars} = adviceModuleProperties[adviceId] || {}
  return titleXStars[numStars] || title
}


export {isAnyAdviceScored, getAdviceScorePriority, getAdviceTitle}

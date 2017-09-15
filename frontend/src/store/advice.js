// TODO(pascal): Move this file to the store.
import adviceModuleProperties from 'components/advisor/data/advice_modules.json'


function getAdviceTitle(advice) {
  if (advice.title) {
    return advice.title
  }
  const {adviceId, numStars} = advice
  const {title, titleXStars} = adviceModuleProperties[adviceId] || {}
  return titleXStars && titleXStars[numStars] || title
}


export {getAdviceTitle}

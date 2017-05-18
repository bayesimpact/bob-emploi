// TODO(pascal): Move this file to the store.
import adviceModuleProperties from 'components/advisor/data/advice_modules.json'


function getAdviceTitle(advice) {
  const {adviceId, numStars} = advice
  const {title, titleXStars} = adviceModuleProperties[adviceId] || {}
  return titleXStars[numStars] || title
}


export {getAdviceTitle}

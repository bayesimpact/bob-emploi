function priorityTitle({numStars}, priority) {
  return ((numStars || 1) >= 2) ? `Priorité n°${priority}` : 'À regarder'
}

// TODO(guillaume): Put simple tests for the following two functions.
function isAnyAdviceScored(project) {
  return (project.advices || []).filter(advice => advice.score).length > 0
}


function getAdviceScorePriority(score) {
  return score >= 7 ? 'prioritaire' : score >= 4 ? 'moyennement prioritaire' : 'peu prioritaire'
}


export {priorityTitle, isAnyAdviceScored, getAdviceScorePriority}

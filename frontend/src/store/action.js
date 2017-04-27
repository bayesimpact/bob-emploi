function isActionStuck(action) {
  return action.status === 'ACTION_STUCK' || action.status === 'ACTION_STICKY_DONE'
}

// Compute the progress of completion of a sticky action. Returns a number
// between 0.02 (just started) and 1 (finished).
function stickyProgress(action) {
  if (!(action.steps || []).length) {
    return 0
  }
  return .02 + .98 * action.steps.filter(step => step.isDone).length / action.steps.length
}

export {isActionStuck, stickyProgress}

// Set of statuses for which the stopped_at field does not mean much as those
// actions where stopped automatically.
const autoStoppedStatuses = {
  ACTION_CURRENT: true,
  ACTION_UNREAD: true,
}

function actionHistoryDate(action) {
  const date = autoStoppedStatuses[action.status] ? action.createdAt : action.stoppedAt
  return date ? date.substr(0, '2016-10-19'.length) : ''
}

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

export {actionHistoryDate, isActionStuck, stickyProgress}

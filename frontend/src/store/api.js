import config from 'config'

function cleanHtmlError(htmlErrorPage) {
  const page = document.createElement('html')
  page.innerHTML = htmlErrorPage
  const content = page.getElementsByTagName('P')
  return content.length && content[0].innerText || page.innerText
}

function handleJsonResponse(response) {
  // Errors are in HTML, not JSON.
  if (response.status >= 400 || response.status < 200) {
    return response.text().then(errorMessage => {
      throw cleanHtmlError(errorMessage)
    })
  }
  return response.json()
}

function postJson(path, data, isExpectingResponse) {
  const url = config.backendHostName + path
  const fetchPromise = fetch(url, {
    body: JSON.stringify(data),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'post',
  })
  if (isExpectingResponse) {
    return fetchPromise.then(handleJsonResponse)
  }
  return fetchPromise
}

function deleteJson(path, data) {
  const url = config.backendHostName + path
  return fetch(url, {
    body: JSON.stringify(data),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'delete',
  }).then(handleJsonResponse)
}

function getJson(path) {
  const url = config.backendHostName + path
  return fetch(url).then(handleJsonResponse)
}

function adviceTipsGet({userId}, {projectId}, {adviceId}) {
  return getJson(`/api/project/${userId}/${projectId}/advice/${adviceId}/tips`).
    then(response => response.tips)
}

function associationsGet({userId}, {projectId}) {
  return getJson(`/api/project/${userId}/${projectId}/associations`).
    then(response => response.associations || [])
}

function dashboardExportGet(dashboardExportId) {
  return getJson(`/api/dashboard-export/${dashboardExportId}`)
}

function evalUseCasePoolNamesGet() {
  return getJson('/api/eval/use-case-pool-names')
}

function evalUseCasesGet(poolName) {
  return getJson(`/api/eval/use-cases/${poolName}`)
}

function interviewTipsGet({userId}, {projectId}) {
  return getJson(`/api/project/${userId}/${projectId}/interview-tips`)
}

function jobBoardsGet({userId}, {projectId}) {
  return getJson(`/api/project/${userId}/${projectId}/jobboards`).
    then(response => response.jobBoards || [])
}

function jobsGet(romeId) {
  return getJson(`/api/jobs/${romeId}`)
}

function markUsedAndRetrievePost(userId) {
  return postJson(`/api/app/use/${userId}`, undefined, true)
}

function migrateUserToAdvisorPost({userId}) {
  return postJson(`/api/user/${userId}/migrate-to-advisor`, undefined, true)
}

function projectComputeAdvicesPost(user) {
  return postJson('/api/project/compute-advices', user, true)
}

function projectRequirementsGet(project) {
  return postJson('/api/project/requirements', project, true)
}

function resetPasswordPost(email) {
  return postJson('/api/user/reset-password', {email}, true)
}

function resumeTipsGet({userId}, {projectId}) {
  return getJson(`/api/project/${userId}/${projectId}/resume-tips`)
}

function saveLikes(userId, likes) {
  return postJson('/api/user/likes', {likes, userId}, false)
}

function userPost(user) {
  const {onboardingComplete, ...protoUser} = user
  // Unused.
  onboardingComplete
  return postJson('/api/user', {...protoUser}, true)
}

function userDelete(user) {
  return deleteJson('/api/user', user)
}

function userAuthenticate(authRequest) {
  return postJson('/api/user/authenticate', authRequest, true)
}

function volunteeringMissionsGet({userId}, {projectId}) {
  return getJson(`/api/project/${userId}/${projectId}/volunteer`).
    then(response => response.missions || [])
}

function commutingCitiesGet({userId}, {projectId}) {
  return getJson(`/api/project/${userId}/${projectId}/commute`).
    then(response => response.cities || [])
}

function feedbackPost(feedback) {
  return postJson('/api/feedback', feedback, false)
}

export {
  adviceTipsGet,
  associationsGet,
  dashboardExportGet,
  evalUseCasePoolNamesGet,
  evalUseCasesGet,
  feedbackPost,
  interviewTipsGet,
  jobBoardsGet,
  jobsGet,
  markUsedAndRetrievePost,
  migrateUserToAdvisorPost,
  projectComputeAdvicesPost,
  projectRequirementsGet,
  resetPasswordPost,
  resumeTipsGet,
  saveLikes,
  userAuthenticate,
  userDelete,
  userPost,
  volunteeringMissionsGet,
  commutingCitiesGet,
}

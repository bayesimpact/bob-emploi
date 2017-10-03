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

function postJson(path, data, isExpectingResponse, authToken) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  const fetchPromise = fetch(path, {
    body: JSON.stringify(data),
    headers,
    method: 'post',
  })
  if (isExpectingResponse) {
    return fetchPromise.then(handleJsonResponse)
  }
  return fetchPromise
}

function deleteJson(path, data, authToken) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  return fetch(path, {
    body: JSON.stringify(data),
    headers,
    method: 'delete',
  }).then(handleJsonResponse)
}

function getJson(path, authToken) {
  const args = authToken ? {headers: {'Authorization': 'Bearer ' + authToken}} : {}
  return fetch(path, args).then(handleJsonResponse)
}

function adviceTipsGet({userId}, {projectId}, {adviceId}, authToken) {
  return getJson(`/api/project/${userId}/${projectId}/advice/${adviceId}/tips`, authToken).
    then(response => response.tips)
}

function createEvalUseCasePost(poolName, email, googleIdToken) {
  return postJson('/api/eval/use-case/create', {email, poolName}, true, googleIdToken)
}

function dashboardExportGet(dashboardExportId) {
  return getJson(`/api/dashboard-export/${dashboardExportId}`)
}

function evalUseCasePoolsGet() {
  return getJson('/api/eval/use-case-pools').
    then(response => response.useCasePools || [])
}

function evalUseCasesGet(poolName) {
  return getJson(`/api/eval/use-cases/${poolName}`).
    then(response => response.useCases || [])
}

function expandedCardContentGet(user, project, {adviceId}, authToken) {
  if (user.userId && project.project.id) {
    return getJson(`/api/project/${user.userId}/${project.projectId}/${adviceId}`, authToken)
  }
  return postJson(
    `/api/advice/${adviceId}`,
    {
      ...user,
      projects: (user.projects || []).filter(p => p.projectId === project.projectId),
    },
    true)
}

function jobsGet(romeId) {
  return getJson(`/api/jobs/${romeId}`)
}

function markUsedAndRetrievePost(userId, authToken) {
  return postJson(`/api/app/use/${userId}`, undefined, true, authToken)
}

function migrateUserToAdvisorPost({userId}, authToken) {
  return postJson(`/api/user/${userId}/migrate-to-advisor`, undefined, true, authToken)
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

function saveLikes(userId, likes, authToken) {
  return postJson('/api/user/likes', {likes, userId}, false, authToken)
}

function userPost(user, token) {
  const {onboardingComplete, ...protoUser} = user
  // Unused.
  onboardingComplete
  return postJson('/api/user', {...protoUser}, true, token)
}

function userDelete(user, authToken) {
  return deleteJson('/api/user', user, authToken)
}

function userAuthenticate(authRequest) {
  return postJson('/api/user/authenticate', authRequest, true)
}

function feedbackPost(feedback, authToken) {
  return postJson('/api/feedback', feedback, false, authToken)
}

export {
  adviceTipsGet,
  createEvalUseCasePost,
  dashboardExportGet,
  evalUseCasePoolsGet,
  evalUseCasesGet,
  expandedCardContentGet,
  feedbackPost,
  jobsGet,
  markUsedAndRetrievePost,
  migrateUserToAdvisorPost,
  projectComputeAdvicesPost,
  projectRequirementsGet,
  resetPasswordPost,
  saveLikes,
  userAuthenticate,
  userDelete,
  userPost,
}

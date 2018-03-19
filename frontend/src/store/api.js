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

function evalUseCasePoolsGet(authToken) {
  return getJson('/api/eval/use-case-pools', authToken).
    then(response => response.useCasePools || [])
}

function evalUseCasesGet(poolName, authToken) {
  return getJson(`/api/eval/use-cases/${poolName}`, authToken).
    then(response => response.useCases || [])
}

function expandedCardContentGet(user, project, {adviceId}, authToken) {
  if (user.userId && project.projectId) {
    return getJson(`/api/advice/${adviceId}/${user.userId}/${project.projectId}`, authToken)
  }
  return postJson(
    `/api/advice/${adviceId}`,
    {
      ...user,
      projects: (user.projects || []).filter(p => p.projectId === project.projectId),
    },
    true)
}

function jobRequirementsGet(romeId) {
  return getJson(`/api/job/requirements/${romeId}`)
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

function projectDiagnosePost(user) {
  return postJson('/api/project/diagnose', user, true)
}

function resetPasswordPost(email) {
  return postJson('/api/user/reset-password', {email}, true)
}

function userCountGet() {
  return getJson('/api/users/counts')
}

function userPost(user, token) {
  return postJson('/api/user', user, true, token)
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
  jobRequirementsGet,
  jobsGet,
  markUsedAndRetrievePost,
  migrateUserToAdvisorPost,
  projectComputeAdvicesPost,
  projectDiagnosePost,
  resetPasswordPost,
  userAuthenticate,
  userCountGet,
  userDelete,
  userPost,
}

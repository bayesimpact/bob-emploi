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

function postJson(path, data) {
  const url = config.backendHostName + path
  return fetch(url, {
    body: JSON.stringify(data),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'post',
  }).then(handleJsonResponse)
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

function createDashboardExportPost(userId) {
  return postJson('/api/dashboard-export/create', {userId})
}

function dashboardExportGet(dashboardExportId) {
  return getJson(`/api/dashboard-export/${dashboardExportId}`)
}

function markUsedAndRetrievePost(userId) {
  return postJson(`/api/app/use/${userId}`)
}

function projectRequirementsGet(project) {
  return postJson('/api/project/requirements', project)
}

function projectPotentialChantiersGet(userId, projectId) {
  return getJson(`/api/project/${userId}/${projectId}/potential-chantiers`)
}

function projectUpdateChantiersPost(userId, projectId, chantierIds) {
  return postJson(
      `/api/project/${userId}/${projectId}/update-chantiers`,
      {chantierIds})
}

function refreshActionPlanPost(userId) {
  return postJson('/api/user/refresh-action-plan', {userId})
}

function resetPasswordPost(email) {
  return postJson('/api/user/reset-password', {email})
}

function userPost(user) {
  const {onboardingComplete, ...protoUser} = user
  // Unused.
  onboardingComplete
  return postJson('/api/user', {...protoUser})
}

function userGet(userId) {
  return getJson(`/api/user/${userId}`)
}

function userDelete(user) {
  return deleteJson('/api/user', user)
}

function userAuthenticate(authRequest) {
  return postJson('/api/user/authenticate', authRequest)
}

function exploreGet(city, sourceJob) {
  const data = {city, sourceJob}
  return getJson(`/api/explore/job?data=${encodeURIComponent(JSON.stringify(data))}`)
}

function exploreJobGroupGet(city, jobGroupRomeId) {
  const data = {
    city,
    sourceJob: {jobGroup: {romeId: jobGroupRomeId}},
  }
  return getJson(`/api/explore/job/stats?data=${encodeURIComponent(JSON.stringify(data))}`)
}

function chantiersGet() {
  return getJson('/api/chantiers')
}

const api = {
  chantiersGet,
  createDashboardExportPost,
  dashboardExportGet,
  exploreGet,
  exploreJobGroupGet,
  markUsedAndRetrievePost,
  projectPotentialChantiersGet,
  projectRequirementsGet,
  projectUpdateChantiersPost,
  refreshActionPlanPost,
  resetPasswordPost,
  userAuthenticate,
  userDelete,
  userGet,
  userPost,
}


export {api}

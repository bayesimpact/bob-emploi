import i18n from 'i18next'

import {forwardCancellation} from 'store/promise'
import type {HTTPRequest, HTTPResponse} from 'store/http'
import {cleanHtmlError, hasErrorStatus} from 'store/http'

async function handleJsonResponse<T>(response: HTTPResponse): Promise<T> {
  // Errors are in HTML, not JSON.
  if (hasErrorStatus(response)) {
    throw await cleanHtmlError(response)
  }
  return response.json()
}

const fetchWithoutCookies = (path: string, request: HTTPRequest, isCancelable = !!AbortController):
Promise<HTTPResponse> => {
  const controller = isCancelable ? new AbortController() : {abort: () => void 0, signal: undefined}
  return forwardCancellation(
    fetch(path, {
      // TODO(pascal): Re-enable cookies from the client but probably not on all URLs. They were
      // removed in da1a8acd089d97163b54bfe70b87e348da484205 but we are now going to use them.
      credentials: 'omit',
      ...request,
      headers: {
        ...request.headers,
        ...(i18n.languages ? {'Accept-language': i18n.languages.join(',')} : undefined),
      },
      signal: controller.signal,
    }),
    () => controller.abort(),
  )
}


interface PostOptions {
  authToken?: string
  isExpectingResponse?: boolean
  isCancelable?: boolean
}


function postJson<T>(
  path: string, data: unknown,
  options: {isExpectingResponse: true} & PostOptions): Promise<T>
function postJson(
  path: string, data: unknown,
  options?: {isExpectingResponse?: false} & PostOptions): Promise<HTTPResponse>
async function postJson<T>(
  path: string, data: unknown, options?: PostOptions): Promise<T | HTTPResponse> {
  const {isExpectingResponse, authToken, isCancelable = !!AbortController} = options || {}
  const headers: {[key: string]: string} = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  const response = await fetchWithoutCookies(path, {
    body: JSON.stringify(data),
    headers,
    method: 'post',
  }, isCancelable)
  if (isExpectingResponse) {
    return handleJsonResponse<T>(response)
  }
  return response
}

async function deleteJson<T>(path: string, data: unknown, authToken?: string): Promise<T> {
  const headers: {[key: string]: string} = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  const response = await fetchWithoutCookies(path, {
    body: JSON.stringify(data),
    headers,
    method: 'delete',
  })
  return handleJsonResponse<T>(response)
}

async function getJson<T>(path: string, authToken?: string): Promise<T> {
  const headers: {[key: string]: string} = {
    Accept: 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  const response = await fetchWithoutCookies(path, {headers})
  return handleJsonResponse<T>(response)
}

async function adviceTipsGet(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, {adviceId}: bayes.bob.Advice,
  authToken: string): Promise<readonly bayes.bob.Action[]> {
  const {tips} = await getJson<bayes.bob.AdviceTips>(
    `/api/advice/tips/${adviceId}/${userId}/${projectId}`, authToken)
  return tips || []
}

async function convertFromProtoPost<K extends keyof bayes.bob.Reflection>(key: K, proto: string):
Promise<bayes.bob.Reflection[K]> {
  const response = await fetchWithoutCookies('/api/proto', {
    body: proto,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-protobuf-base64',
    },
    method: 'post',
  })
  const value = await handleJsonResponse<NonNullable<bayes.bob.Reflection>>(response)
  return value[key]
}

async function convertToProtoPost<K extends keyof bayes.bob.Reflection>(
  key: K, proto: NonNullable<bayes.bob.Reflection[K]>): Promise<string> {
  const reflectionProto: bayes.bob.Reflection = {[key]: proto}
  const response = await fetchWithoutCookies('/api/proto', {
    body: JSON.stringify(reflectionProto),
    headers: {
      'Accept': 'application/x-protobuf-base64',
      'Content-Type': 'application/json',
    },
    method: 'post',
  })
  const text = await response.text()
  return text.replace(/\n/g, '')
}

function diagnosticMainChallengesPost(user: bayes.bob.User):
Promise<bayes.bob.DiagnosticMainChallenges> {
  return postJson('/api/diagnostic/main-challenges', user, {isExpectingResponse: true})
}

function expandedCardContentGet<T>(
  user: bayes.bob.User, project: bayes.bob.Project, {adviceId}: bayes.bob.Advice,
  authToken?: string): Promise<T> {
  if (user.userId && project.projectId) {
    if (!authToken) {
      throw new Error("L'authentification de la connexion a été perdue")
    }
    return getJson(`/api/advice/${adviceId}/${user.userId}/${project.projectId}`, authToken)
  }
  return postJson(
    `/api/advice/${adviceId}`,
    {
      ...user,
      projects: (user.projects || []).filter((p): boolean => p.projectId === project.projectId),
    },
    {isExpectingResponse: true})
}

function jobRequirementsGet(romeId: string): Promise<bayes.bob.JobRequirements> {
  return getJson(`/api/job/requirements/${romeId}`)
}

function jobsGet(romeId: string): Promise<bayes.bob.JobGroup> {
  return getJson(`/api/jobs/${romeId}`)
}

function applicationModesGet(romeId: string): Promise<bayes.bob.JobGroup> {
  return getJson(`/api/job/application-modes/${romeId}`)
}

function authTokensGet(userId: string, authToken: string): Promise<bayes.bob.AuthTokens> {
  return getJson(`/api/user/${userId}/generate-auth-tokens`, authToken)
}

function userCountsGet(): Promise<bayes.bob.UsersCount> {
  return getJson('/api/usage/stats')
}

function logoutPost(): Promise<unknown> {
  return postJson('/api/user/logout', undefined)
}

function markUsedAndRetrievePost(userId: string, authToken: string): Promise<bayes.bob.User> {
  return postJson(`/api/app/use/${userId}`, undefined, {authToken, isExpectingResponse: true})
}

function migrateUserToAdvisorPost({userId}: bayes.bob.User, authToken: string):
Promise<bayes.bob.User> {
  return postJson(
    `/api/user/${userId}/migrate-to-advisor`, undefined, {authToken, isExpectingResponse: true})
}

function onboardingDiagnosePost(data: bayes.bob.QuickDiagnosticRequest, authToken: string):
Promise<bayes.bob.QuickDiagnostic> {
  const {userId, projects: [{projectId = ''} = {}] = []} = data.user || {}
  const path = projectId ? `/api/user/${userId}/update-and-quick-diagnostic/project/${projectId}` :
    `/api/user/${userId}/update-and-quick-diagnostic`
  return postJson(path, data, {authToken, isExpectingResponse: true})
}

function projectComputeActionsPost(user: bayes.bob.User): Promise<bayes.bob.Actions> {
  return postJson('/api/project/compute-actions', user, {isExpectingResponse: true})
}

function projectComputeAdvicesPost(user: bayes.bob.User): Promise<bayes.bob.Advices> {
  return postJson('/api/project/compute-advices', user, {isExpectingResponse: true})
}

function projectDiagnosePost(user: bayes.bob.User): Promise<bayes.bob.Diagnostic> {
  return postJson('/api/project/diagnose', user, {isExpectingResponse: true})
}

function projectStrategizePost(user: bayes.bob.User): Promise<bayes.bob.Strategies> {
  return postJson('/api/project/strategize', user, {isExpectingResponse: true})
}

function resetPasswordPost(email: string): Promise<string> {
  return postJson('/api/user/reset-password', {email}, {isExpectingResponse: true})
}

function userPost(user: bayes.bob.User, authToken: string): Promise<bayes.bob.User> {
  return postJson('/api/user', user, {authToken, isCancelable: false, isExpectingResponse: true})
}

function projectPost(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, project: bayes.bob.Project,
  authToken: string): Promise<bayes.bob.Project> {
  return postJson(
    `/api/user/${userId}/project/${projectId}`, project, {authToken, isExpectingResponse: true})
}

function advicePost(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, {adviceId}: bayes.bob.Advice,
  advice: bayes.bob.Advice, authToken: string): Promise<bayes.bob.Advice> {
  return postJson(
    `/api/user/${userId}/project/${projectId}/advice/${adviceId}`, advice,
    {authToken, isExpectingResponse: true})
}

function actionPost(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, {actionId}: bayes.bob.Action,
  action: bayes.bob.Action, authToken: string): Promise<bayes.bob.Action> {
  return postJson(
    `/api/user/${userId}/project/${projectId}/action/${actionId}`, action,
    {authToken, isExpectingResponse: true})
}

function listUserEmailsGet(
  {userId}: bayes.bob.User, authToken: string): Promise<bayes.bob.Campaigns> {
  return getJson(`/api/user/${userId}/emails`, authToken)
}

function sendEmailPost(
  user: bayes.bob.User, campaignId: string, googleIdToken: string): Promise<unknown> {
  return postJson(
    `/api/emails/send/${campaignId}`, user, {authToken: googleIdToken, isExpectingResponse: true})
}

function sendUserEmailPost(
  {userId}: bayes.bob.User, campaignId: string, authToken: string): Promise<unknown> {
  return postJson(
    `/api/user/${userId}/emails/send/${campaignId}`, 0, {authToken, isExpectingResponse: true})
}

function simulateFocusEmailsPost(user: bayes.bob.User): Promise<bayes.bob.EmailHistory> {
  return postJson('/api/emails/simulate', user, {isExpectingResponse: true})
}

async function strategyDelete(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, {strategyId}: bayes.bob.Strategy,
  authToken: string): Promise<string> {
  const path = `/api/user/${userId}/project/${projectId}/strategy/${strategyId}`
  const response = await fetchWithoutCookies(path, {
    headers: {Authorization: `Bearer ${authToken}`},
    method: 'delete',
  })
  return response.text()
}

function strategyPost(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, strategy: bayes.bob.Strategy,
  authToken: string): Promise<bayes.bob.Strategy> {
  const {strategyId} = strategy
  return postJson(
    `/api/user/${userId}/project/${projectId}/strategy/${strategyId}`, strategy,
    {authToken, isExpectingResponse: true})
}

function supportTicketPost(userId: string, authToken: string, ticketId: string): Promise<unknown> {
  return postJson(`/api/support/${userId}/${ticketId}`, undefined, {authToken})
}

function userDelete(user: bayes.bob.User, authToken: string): Promise<bayes.bob.User> {
  return deleteJson('/api/user', user, authToken)
}

// Authenticate a user.
// As opposed to other function in this module, this one differentiates client errors (bad auth
// token) and server errors (HTTP 500 and such). In the latter case, it actually returns a
// hand made custom response so that the callers can handle it differently.
async function userAuthenticate(authRequest: bayes.bob.AuthRequest):
Promise<bayes.bob.AuthResponse> {
  const response = await postJson('/api/user/authenticate', authRequest)
  if (response.status >= 500) {
    return {
      errorMessage: await cleanHtmlError(response),
      isServerError: true,
    }
  }
  if (response.status === 498) {
    return {
      errorMessage: await cleanHtmlError(response),
      hasTokenExpired: true,
    }
  }
  return handleJsonResponse<bayes.bob.AuthResponse>(response)
}

function feedbackPost(feedback: bayes.bob.Feedback, authToken?: string): Promise<unknown> {
  return postJson('/api/feedback', feedback, {authToken})
}

function projectLaborStatsPost(user: bayes.bob.User): Promise<bayes.bob.LaborStatsData> {
  return postJson('/api/compute-labor-stats', user, {isExpectingResponse: true})
}

function aliUserDataPost(request: bayes.ali.User): Promise<bayes.ali.EmailStatuses> {
  return postJson('/api/ali/user', request, {isExpectingResponse: true})
}

async function upskillingSectionsPost(user: bayes.bob.User):
Promise<readonly bayes.upskilling.Section[]> {
  const {sections} = await postJson<bayes.upskilling.Sections>(
    '/api/upskilling/sections', user, {isExpectingResponse: true})
  return sections || []
}

async function upskillingSectionsMoreJobPost(
  user: bayes.bob.User, section: bayes.upskilling.Section,
): Promise<readonly bayes.upskilling.Job[]> {
  const {jobs} = await postJson<bayes.upskilling.Section>(
    `/api/upskilling/sections/${section.id || ''}/jobs/${section.state || ''}`, user,
    {isExpectingResponse: true})
  return jobs || []
}

function upskillingSaveUser(user: bayes.bob.User): Promise<unknown> {
  return postJson('/api/upskilling/user', user)
}

function feedbackVolunteeringSend(email: string, topic: string): Promise<unknown|string> {
  return fetch(`/api/feedback/volunteer/${topic}?email=${email}`)
}

function actionPlanEmailPost(userId: string, projectId: string, authToken: string):
Promise<unknown> {
  return postJson(`/api/user/${userId}/project/${projectId}/send-action-plan`, undefined, {
    authToken,
    isExpectingResponse: true,
  })
}

export {
  actionPlanEmailPost,
  actionPost,
  advicePost,
  adviceTipsGet,
  aliUserDataPost,
  applicationModesGet,
  authTokensGet,
  convertFromProtoPost,
  convertToProtoPost,
  diagnosticMainChallengesPost,
  expandedCardContentGet,
  feedbackPost,
  getJson,
  jobRequirementsGet,
  jobsGet,
  listUserEmailsGet,
  logoutPost,
  markUsedAndRetrievePost,
  migrateUserToAdvisorPost,
  onboardingDiagnosePost,
  postJson,
  projectComputeActionsPost,
  projectComputeAdvicesPost,
  projectDiagnosePost,
  projectLaborStatsPost,
  projectStrategizePost,
  projectPost,
  resetPasswordPost,
  sendEmailPost,
  sendUserEmailPost,
  simulateFocusEmailsPost,
  strategyDelete,
  strategyPost,
  supportTicketPost,
  feedbackVolunteeringSend,
  upskillingSaveUser,
  upskillingSectionsMoreJobPost,
  upskillingSectionsPost,
  userAuthenticate,
  userCountsGet,
  userDelete,
  userPost,
}

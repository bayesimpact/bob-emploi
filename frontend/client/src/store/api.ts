function cleanHtmlError(htmlErrorPage: string): string {
  const page = document.createElement('html')
  page.innerHTML = htmlErrorPage
  const content = page.getElementsByTagName('P') as HTMLCollectionOf<HTMLElement>
  return content.length && content[0].textContent || page.textContent
}

interface HTTPRequest {
  body?: string
  credentials?: 'omit'
  headers?: {
    [headerName: string]: string
  }
  method?: 'post' | 'get' | 'delete'
}

interface HTTPResponse {
  json: <T>() => Promise<T>
  status: number
  text: () => Promise<string>
}

function handleJsonResponse<T>(response: HTTPResponse): Promise<T> {
  // Errors are in HTML, not JSON.
  if (response.status >= 400 || response.status < 200) {
    return response.text().then((errorMessage): never => {
      throw cleanHtmlError(errorMessage)
    })
  }
  return response.json()
}

const fetchWithoutCookies = (path: string, request: HTTPRequest): Promise<HTTPResponse> =>
  fetch(path, {credentials: 'omit', ...request})

/* eslint-disable @typescript-eslint/no-explicit-any */
function postJson(path: string, data: any, isExpectingResponse: false, authToken?: string):
Promise<HTTPResponse>
function postJson<T>(path: string, data: any, isExpectingResponse: true, authToken?: string):
Promise<T>
function postJson<T>(
  path: string, data: any, isExpectingResponse: boolean, authToken?: string):
  Promise<T | HTTPResponse> {
/* eslint-enable @typescript-eslint/no-explicit-any */
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  const fetchPromise = fetchWithoutCookies(path, {
    body: JSON.stringify(data),
    headers,
    method: 'post',
  })
  if (isExpectingResponse) {
    return fetchPromise.
      then((response: HTTPResponse): Promise<T> => handleJsonResponse<T>(response))
  }
  return fetchPromise
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deleteJson<T>(path: string, data: any, authToken?: string): Promise<T> {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  return fetchWithoutCookies(path, {
    body: JSON.stringify(data),
    headers,
    method: 'delete',
  }).then((response): Promise<T> => handleJsonResponse<T>(response))
}

function getJson<T>(path: string, authToken?: string): Promise<T> {
  const headers = {
    'Accept': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  return fetchWithoutCookies(path, {headers}).
    then((response): Promise<T> => handleJsonResponse<T>(response))
}

function adviceTipsGet(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, {adviceId}: bayes.bob.Advice,
  authToken: string): Promise<bayes.bob.Action[]> {
  return getJson<bayes.bob.AdviceTips>(
    `/api/advice/tips/${adviceId}/${userId}/${projectId}`, authToken).
    then((response): bayes.bob.Action[] => response.tips)
}

function convertUserWithAdviceSelectionFromProtoPost<T>(proto: string): Promise<T> {
  return fetchWithoutCookies('/api/user/proto', {
    body: proto,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-protobuf-base64',
    },
    method: 'post',
  }).then((response): Promise<T> => handleJsonResponse<T>(response))
}

function convertUserWithAdviceSelectionToProtoPost<T>(proto: T): Promise<string> {
  return fetchWithoutCookies('/api/user/proto', {
    body: JSON.stringify(proto),
    headers: {
      'Accept': 'application/x-protobuf-base64',
      'Content-Type': 'application/json',
    },
    method: 'post',
  }).then((response): Promise<string> => response.text()).
    then((response: string): string => response.replace(/\n/g, ''))
}

function createEvalUseCasePost(request: bayes.bob.UseCaseCreateRequest, googleIdToken: string):
Promise<bayes.bob.UseCase> {
  return postJson('/api/eval/use-case/create', request, true, googleIdToken)
}

function evalUseCasePoolsGet(authToken: string): Promise<bayes.bob.UseCasePool[]> {
  return getJson<bayes.bob.UseCasePools>('/api/eval/use-case-pools', authToken).
    then((response): bayes.bob.UseCasePool[] => response.useCasePools || [])
}

function evalFiltersUseCasesPost(
  filters: string[], googleIdToken: string): Promise<bayes.bob.UseCase[]> {
  return postJson<bayes.bob.UseCases>('/api/eval/use-case/filters', {filters}, true, googleIdToken).
    then((response): bayes.bob.UseCase[] => response.useCases || [])
}

function evalUseCasesGet(poolName: string, authToken: string): Promise<bayes.bob.UseCase[]> {
  return getJson<bayes.bob.UseCases>(`/api/eval/use-cases/${poolName}`, authToken).
    then((response): bayes.bob.UseCase[] => response.useCases || [])
}

function useCaseDistributionPost(
  categories: bayes.bob.UseCasesDistributionRequest, authToken: string):
  Promise<bayes.bob.UseCaseDistribution> {
  return postJson('/api/eval/category/distribution', categories, true, authToken)
}

function expandedCardContentGet<T>(
  user: bayes.bob.User, project: bayes.bob.Project, {adviceId}: bayes.bob.Advice,
  authToken: string): Promise<T> {
  if (user.userId && project.projectId) {
    return getJson(`/api/advice/${adviceId}/${user.userId}/${project.projectId}`, authToken)
  }
  return postJson(
    `/api/advice/${adviceId}`,
    {
      ...user,
      projects: (user.projects || []).filter((p): boolean => p.projectId === project.projectId),
    },
    true)
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

function markUsedAndRetrievePost(userId: string, authToken: string): Promise<bayes.bob.User> {
  return postJson(`/api/app/use/${userId}`, undefined, true, authToken)
}

function migrateUserToAdvisorPost({userId}: bayes.bob.User, authToken: string):
Promise<bayes.bob.User> {
  return postJson(`/api/user/${userId}/migrate-to-advisor`, undefined, true, authToken)
}

function onboardingDiagnosePost(data: bayes.bob.QuickDiagnosticRequest, authToken: string):
Promise<bayes.bob.QuickDiagnostic> {
  const {userId, projects: [{projectId = ''} = {}] = []} = data.user
  const path = projectId ? `/api/user/${userId}/update-and-quick-diagnostic/project/${projectId}` :
    `/api/user/${userId}/update-and-quick-diagnostic`
  return postJson(path, data, true, authToken)
}

function projectComputeAdvicesPost(user: bayes.bob.User): Promise<bayes.bob.Advices> {
  return postJson('/api/project/compute-advices', user, true)
}

function projectDiagnosePost(user: bayes.bob.User): Promise<bayes.bob.Diagnostic> {
  return postJson('/api/project/diagnose', user, true)
}

function projectStrategizePost(user: bayes.bob.User): Promise<bayes.bob.Strategies> {
  return postJson('/api/project/strategize', user, true)
}

function resetPasswordPost(email: string): Promise<string> {
  return postJson('/api/user/reset-password', {email}, true)
}

function userPost(user: bayes.bob.User, token: string): Promise<bayes.bob.User> {
  return postJson('/api/user', user, true, token)
}

function projectPost(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, project: bayes.bob.Project,
  authToken: string): Promise<bayes.bob.Project> {
  return postJson(
    `/api/user/${userId}/project/${projectId}`, project, true, authToken)
}

function advicePost(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, {adviceId}: bayes.bob.Advice,
  advice: bayes.bob.Advice, authToken: string): Promise<bayes.bob.Advice> {
  return postJson(
    `/api/user/${userId}/project/${projectId}/advice/${adviceId}`, advice, true, authToken)
}

function strategyPost(
  {userId}: bayes.bob.User, {projectId}: bayes.bob.Project, strategy: bayes.bob.Strategy,
  authToken: string): Promise<bayes.bob.Strategy> {
  const {strategyId} = strategy
  return postJson(
    `/api/user/${userId}/project/${projectId}/strategy/${strategyId}`, strategy, true, authToken)
}

function userDelete(user: bayes.bob.User, authToken: string): Promise<bayes.bob.User> {
  return deleteJson('/api/user', user, authToken)
}

function userAuthenticate(authRequest: bayes.bob.AuthRequest): Promise<bayes.bob.AuthResponse> {
  return postJson('/api/user/authenticate', authRequest, true)
}

function feedbackPost(feedback: bayes.bob.Feedback, authToken: string): Promise<{}> {
  return postJson('/api/feedback', feedback, false, authToken)
}

function projectLaborStatsPost(user: bayes.bob.User): Promise<bayes.bob.LaborStatsData> {
  return postJson('/api/compute-labor-stats', user, true)
}

function getAllCategoriesPost(useCase: bayes.bob.UseCase, authToken: string):
Promise<bayes.bob.DiagnosticCategories> {
  return postJson('/api/eval/use-case/categories', useCase, true, authToken)
}

export {
  advicePost,
  adviceTipsGet,
  applicationModesGet,
  convertUserWithAdviceSelectionFromProtoPost,
  convertUserWithAdviceSelectionToProtoPost,
  createEvalUseCasePost,
  evalFiltersUseCasesPost,
  evalUseCasePoolsGet,
  evalUseCasesGet,
  expandedCardContentGet,
  feedbackPost,
  getAllCategoriesPost,
  jobRequirementsGet,
  jobsGet,
  markUsedAndRetrievePost,
  migrateUserToAdvisorPost,
  onboardingDiagnosePost,
  projectComputeAdvicesPost,
  projectDiagnosePost,
  projectLaborStatsPost,
  projectStrategizePost,
  projectPost,
  resetPasswordPost,
  strategyPost,
  useCaseDistributionPost,
  userAuthenticate,
  userDelete,
  userPost,
}
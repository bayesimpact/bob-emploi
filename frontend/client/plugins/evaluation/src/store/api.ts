// API to the evaluation plugin on Bob server.
import {getJson, postJson} from 'store/api'

function createEvalUseCasePost(request: bayes.bob.UseCaseCreateRequest, googleIdToken: string):
Promise<bayes.bob.UseCase> {
  return postJson(
    '/api/eval/use-case/create', request, {authToken: googleIdToken, isExpectingResponse: true})
}

async function evalUseCasePoolsGet(authToken: string): Promise<readonly bayes.bob.UseCasePool[]> {
  const {useCasePools} =
    await getJson<bayes.bob.UseCasePools>('/api/eval/use-case-pools', authToken)
  return useCasePools || []
}

async function evalFiltersUseCasesPost(
  filters: readonly string[], googleIdToken: string): Promise<readonly bayes.bob.UseCase[]> {
  const {useCases} = await postJson<bayes.bob.UseCases>(
    '/api/eval/use-case/filters', {filters}, {authToken: googleIdToken, isExpectingResponse: true})
  return useCases || []
}

async function evalUseCasesGet(poolName: string, authToken: string):
Promise<readonly bayes.bob.UseCase[]> {
  const {useCases} = await getJson<bayes.bob.UseCases>(`/api/eval/use-cases/${poolName}`, authToken)
  return useCases || []
}

function getAllMainChallengesPost(useCase: bayes.bob.UseCase, authToken: string):
Promise<bayes.bob.DiagnosticMainChallenges> {
  return postJson(
    '/api/eval/use-case/main-challenges', useCase, {authToken, isExpectingResponse: true})
}

function saveUseCaseEvalPost(
  useCaseId: string, evaluation: bayes.bob.UseCaseEvaluation, authToken: string,
): Promise<unknown> {
  return postJson(`/api/eval/use-case/${useCaseId}`, evaluation, {authToken})
}

function useCaseDistributionPost(
  mainChallenges: bayes.bob.UseCasesDistributionRequest, authToken: string):
  Promise<bayes.bob.UseCaseDistribution> {
  return postJson(
    '/api/eval/main-challenge/distribution', mainChallenges, {authToken, isExpectingResponse: true})
}

export {
  createEvalUseCasePost,
  evalFiltersUseCasesPost,
  evalUseCasePoolsGet,
  evalUseCasesGet,
  getAllMainChallengesPost,
  saveUseCaseEvalPost,
  useCaseDistributionPost,
}

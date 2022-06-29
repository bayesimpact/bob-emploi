import type {EvalAppState, AllEvalActions} from './actions'

const appInitialData: EvalAppState = {}

function app(state: EvalAppState = appInitialData, action: AllEvalActions): EvalAppState {
  if (action.type === 'GET_EVAL_USE_CASE_POOLS') {
    if (action.status !== 'success') {
      return state
    }
    return {
      ...state,
      pools: action.response,
    }
  }

  if (action.type === 'GET_EVAL_USE_CASES') {
    if (action.status !== 'success') {
      return state
    }
    return {
      ...state,
      useCases: {
        ...state.useCases,
        [action.poolName]: action.response,
      },
    }
  }

  if (action.type === 'SAVE_USE_CASE_EVAL' && !action.status) {
    const {evaluation, poolName, useCaseId} = action
    // Let the pool know if the use case got evaluated for the first time.
    if (!evaluation) {
      return {
        ...state,
        pools: state.pools?.map((pool): bayes.bob.UseCasePool => {
          if (poolName && pool.name === poolName) {
            return {
              ...pool,
              evaluatedUseCaseCount: (pool.evaluatedUseCaseCount || 0) + 1,
            }
          }
          return pool
        }),
        useCases: poolName ? {
          ...state.useCases,
          [poolName]: (state.useCases?.[poolName] || []).map((useCase): bayes.bob.UseCase => {
            if (useCase.useCaseId === useCaseId) {
              return {
                ...useCase,
                evaluation,
              }
            }
            return useCase
          }),
        } : state.useCases,
      }
    }
    return state
  }

  return state
}

export default app

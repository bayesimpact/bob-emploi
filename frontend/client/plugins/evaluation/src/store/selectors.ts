import {useEffect} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import {DispatchAllEvalActions, EvalRootState, getEvalUseCasePools,
  getEvalUseCases} from './actions'

const emptyArray = [] as const

function usePools(): readonly bayes.bob.UseCasePool[] {
  const pools = useSelector(({eval: {pools}}: EvalRootState) => pools)
  const isFetchingPools = useSelector(
    ({asyncState: {isFetching}}: EvalRootState) => !!isFetching?.['GET_EVAL_USE_CASE_POOLS'],
  )
  const dispatch = useDispatch<DispatchAllEvalActions>()
  const hasPools = !!pools
  useEffect((): void => {
    if (!hasPools && !isFetchingPools) {
      dispatch(getEvalUseCasePools())
    }
  }, [dispatch, hasPools, isFetchingPools])
  return pools || emptyArray
}

function useUseCases(poolName: string|undefined): readonly bayes.bob.UseCase[] {
  const useCases = useSelector(({eval: {useCases}}: EvalRootState) => useCases?.[poolName || ''])
  const hasUseCases = !!useCases
  const dispatch = useDispatch<DispatchAllEvalActions>()
  useEffect(() => {
    if (!hasUseCases && poolName) {
      dispatch(getEvalUseCases(poolName))
    }
  }, [dispatch, hasUseCases, poolName])
  if (!poolName) {
    return emptyArray
  }
  return useCases || emptyArray
}

export {
  usePools,
  useUseCases,
}

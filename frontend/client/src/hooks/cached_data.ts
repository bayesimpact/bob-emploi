import {useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'
import {ThunkAction} from 'redux-thunk'

import {AllActions, DispatchAllActions, RootState} from 'store/actions'
import {useAsynceffect} from 'store/promise'

interface CachedData<DataType> {
  data?: DataType
  loading?: true
}

function useCachedData<DataType>(
  selector: ((state: RootState) => DataType|undefined),
  action: ThunkAction<Promise<DataType|void>, RootState, unknown, AllActions>
): CachedData<DataType>
function useCachedData<FetchedType, CachedType>(
  selector: ((state: RootState) => CachedType|undefined),
  action: ThunkAction<Promise<FetchedType|void>, RootState, unknown, AllActions>,
  reducer: (fetched: FetchedType) => CachedType,
): CachedData<CachedType>
function useCachedData<FetchedType, CachedType=FetchedType>(
  selector: ((state: RootState) => CachedType|undefined),
  action: ThunkAction<Promise<FetchedType|void>, RootState, unknown, AllActions>,
  reducer?: (fetched: FetchedType) => CachedType,
): CachedData<CachedType|FetchedType> {
  const dispatch = useDispatch<DispatchAllActions>()
  const cachedData = useSelector(selector)
  const [queryData, setQueryData] = useState<FetchedType|undefined>()
  const hasData = !!cachedData
  useAsynceffect(async (checkIfCanceled) => {
    if (hasData) {
      return
    }
    setQueryData(undefined)
    const fetchedData = await dispatch(action)
    if (!fetchedData || checkIfCanceled()) {
      return
    }
    setQueryData(fetchedData as FetchedType)
  }, [action, dispatch, hasData])
  if (cachedData) {
    return {data: cachedData}
  }
  if (queryData) {
    return {data: reducer ? reducer(queryData) : queryData}
  }
  return {loading: true}
}

export default useCachedData

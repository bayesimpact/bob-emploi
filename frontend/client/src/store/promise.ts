// Imported from https://github.com/rajeshnaroth/react-cancelable-promise-hook/blob/master/index.js
import {useCallback, useEffect, useRef} from 'react'
import {useDispatch} from 'react-redux'

export interface CancelablePromise<T> {
  cancel: () => void
  promise: Promise<T>
}

type CancelPromiseWrapper = <T>(promise: Promise<T>) => CancelablePromise<T>

const makeCancelable = <T>(promise: Promise<T>): CancelablePromise<T> => {
  let isCanceled = false

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise.then(value => {
      if (!isCanceled) {
        resolve(value)
      }
    }).catch(error => {
      if (!isCanceled) {
        reject(error)
      }
    })
  })

  return {
    cancel: (): void => {
      isCanceled = true
    },
    promise: wrappedPromise,
  }
}


const useCancelablePromises = (cancelable: CancelPromiseWrapper = makeCancelable):
(<T>(promise: Promise<T>) => Promise<T>) => {
  const promises = useRef<CancelablePromise<unknown>[]>([])

  useEffect((): (() => void) => (): void => promises.current.forEach(p => p.cancel()), [])

  return useCallback(<T>(p: Promise<T>): Promise<T> => {
    const cPromise = cancelable(p)
    promises.current.push(cPromise)
    return cPromise.promise
  }, [cancelable])
}


function isPromise<T>(a: unknown): a is Promise<T> {
  return !!(a as Promise<T>)?.then
}


type Promised<P> = P extends Promise<infer T> ? T : never


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useSafeDispatch = <TDispatch extends (arg: any) => any>(
  cancelable: CancelPromiseWrapper = makeCancelable,
): TDispatch => {
  const dispatch = useDispatch<TDispatch>()
  const cancelOnUnmount = useCancelablePromises(cancelable)
  const wrappedDispatch = useCallback((p: Parameters<TDispatch>[0]): ReturnType<TDispatch> => {
    const dispatched = dispatch(p)
    if (isPromise<Promised<ReturnType<TDispatch>>>(dispatched)) {
      return cancelOnUnmount(dispatched) as ReturnType<TDispatch>
    }
    return dispatched
  }, [cancelOnUnmount, dispatch])
  return wrappedDispatch as TDispatch
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeCancelableDispatch = <TDispatch extends (arg: any) => any>(
  dispatch: TDispatch,
  cancelable: CancelPromiseWrapper = makeCancelable,
): [TDispatch, () => void] => {
  const promises: CancelablePromise<unknown>[] = []
  const dispatchWrapper = (p: Parameters<TDispatch>[0]): ReturnType<TDispatch> => {
    const dispatched = dispatch(p)
    if (isPromise<Promised<ReturnType<TDispatch>>>(dispatched)) {
      const promise = cancelable(dispatched)
      promises.push(promise)
      return promise.promise as ReturnType<TDispatch>
    }
    return dispatched
  }
  const cancel = (): void => promises.forEach(p => p.cancel())
  return [dispatchWrapper as TDispatch, cancel]
}


export {makeCancelable, makeCancelableDispatch, useCancelablePromises, useSafeDispatch}

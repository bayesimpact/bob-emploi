// Imported from https://github.com/rajeshnaroth/react-cancelable-promise-hook/blob/master/index.js
import {useCallback, useEffect, useRef} from 'react'
import {useDispatch} from 'react-redux'

export interface CancelablePromise<T> extends Promise<T> {
  cancel: () => void
  // TODO(cyrille): Deprecate, in favor of using the CancelablePromise directly.
  promise: Promise<T>
}

type CancelPromiseWrapper = <T>(promise: Promise<T>) => CancelablePromise<T>

const isCancelable = <T>(promise: Promise<T>): promise is CancelablePromise<T> =>
  !!(promise as CancelablePromise<T>).cancel

// Allow the promise to cancel any callback attached to it (whether on fulfilment or error).
const makeCancelable = <T>(promise: Promise<T>): CancelablePromise<T> => {
  let isCanceled = false

  const wrapPromise = async (): Promise<T> => {
    try {
      const value = await promise
      if (!isCanceled) {
        return value
      }
    } catch (error) {
      if (!isCanceled) {
        throw error
      }
    }
    // Never-returning promise.
    return await new Promise<T>(() => void 0)
  }
  const wrappedPromise = wrapPromise()

  return {
    ...wrappedPromise,
    cancel: (): void => {
      if (isCancelable(promise)) {
        promise.cancel()
      }
      isCanceled = true
    },
    promise: wrappedPromise,
  }
}

// Make this promise and all those that derived from it invoke the cancellation function
// when they're cancelled.
const forwardCancellation = <T>(promise: Promise<T>, cancel: () => void):
CancelablePromise<T> => {
  /* eslint-disable prefer-rest-params */
  function then<U>() {
    // eslint-disable-next-line promise/prefer-await-to-then
    return forwardCancellation(promise.then<U>(...arguments), cancel)
  }
  function cancelableCatch() {
    // eslint-disable-next-line promise/prefer-await-to-then
    return forwardCancellation(promise.catch(...arguments), cancel)
  }
  function cancelableFinally() {
    // eslint-disable-next-line promise/prefer-await-to-then
    return forwardCancellation(promise.finally(...arguments), cancel)
  }
  /* eslint-enable prefer-rest-params */
  return {
    ...promise,
    cancel,
    catch: cancelableCatch,
    finally: cancelableFinally,
    promise,
    then,
  }
}

// TODO(cyrille): Rename to useAsyncEffect once https://github.com/facebook/react/issues/19749
// is solved.
const useAsynceffect = (
  effect: (checkIfCanceled: () => boolean) => Promise<unknown>,
  dependencies?: React.DependencyList,
): void => useEffect(() => {
  let isCanceled = false
  effect(() => isCanceled)
  return () => {
    isCanceled = true
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, dependencies)


const useCancelablePromises = (cancelable: CancelPromiseWrapper = makeCancelable):
(<T>(promise: Promise<T>) => Promise<T>) => {
  const promises = useRef<CancelablePromise<unknown>[]>([])

  useEffect((): (() => void) => (): void => {
    for (const p of promises.current) {
      p.cancel()
    }
  }, [])

  return useCallback(<T>(p: Promise<T>): Promise<T> => {
    const cPromise = cancelable(p)
    promises.current.push(cPromise)
    return cPromise.promise
  }, [cancelable])
}


function isPromise<T>(a: unknown): a is Promise<T> {
  // eslint-disable-next-line promise/prefer-await-to-then
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


export {makeCancelable, forwardCancellation, useAsynceffect, useCancelablePromises, isPromise,
  useSafeDispatch}

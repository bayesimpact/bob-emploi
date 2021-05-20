import {useCallback, useDebugValue, useLayoutEffect} from 'react'
import {useHistory, useRouteMatch} from 'react-router'

interface StepRouteParams<T> {
  step?: T
}

interface RouteStepper<T extends string> {
  index: number
  name: T
  setStep: (name: T) => void
}

// A hook to use steps that can be navigated through the router.
function useNamedRouteStepper<T extends string>(steps: readonly T[]): RouteStepper<T> {
  const history = useHistory()
  const {path: route} = useRouteMatch()
  const setStep = useCallback((step: T): void => {
    history.push(`${route}/${step}`)
  }, [history, route])
  const match = useRouteMatch<StepRouteParams<T>>(`${route}/:step?`)
  const index = match?.params.step === undefined ? -1 : steps.indexOf(match?.params.step)
  useLayoutEffect((): void => {
    if (index < 0) {
      history.replace(`${route}/${steps[0]}`)
    }
  }, [history, index, route, steps])
  const current = {
    index: index < 0 ? 0 : index,
    name: steps[index] || steps[0],
  }
  useDebugValue(current)
  return {
    ...current,
    setStep,
  }
}

function useRouteStepper(numSteps: number): [number, (step: number) => void] {
  const steps = Array.from({length: numSteps}, (unused, index) => index.toString())
  const {index, setStep} = useNamedRouteStepper(steps)
  const setNumberStep = useCallback((step: number): void => setStep(step.toString()), [setStep])
  return [index, setNumberStep]
}


export default useRouteStepper

import {useCallback, useLayoutEffect, useEffect, useState} from 'react'

const getScrollPosition = (): number => window.scrollY ||
  window.pageYOffset ||
  document.body.scrollTop + (document.documentElement.scrollTop || 0)

const getMaxScrollPosition = (): number =>
  document.documentElement.offsetHeight - window.innerHeight

// Add a 5px error margin in the max scroll position reference.
export const computeIsAtBottom = (): boolean => getScrollPosition() >= getMaxScrollPosition() - 5

export function scrollDown(): void {
  window.scrollTo(0, document.body.scrollHeight)
}

// A hook to keep the document scroll at the bottom whenever the calling component is updated.
// - Returns a bool stating whether the user is scrolled at the bottom at rendering time.
// - Triggers a re-render if the user scrolls to the bottom, or leave the bottom.
// Make sure to give the dependencies that might update the size of the page.
function useStayAtBottom(deps: readonly unknown[] = []): boolean {
  const isAtBottomBeforeRender = computeIsAtBottom()
  const [, setIsAtBottom] = useState(isAtBottomBeforeRender)

  const onScroll = useCallback((): void => {
    const isAtBottom = computeIsAtBottom()
    setIsAtBottom(isAtBottom)
  }, [])

  useEffect((): (() => void) => {
    document.addEventListener('scroll', onScroll)
    return (): void => document.removeEventListener('scroll', onScroll)
  }, [onScroll])

  useLayoutEffect((): void => {
    const isAtBottom = computeIsAtBottom()
    if (isAtBottomBeforeRender && !isAtBottom) {
      scrollDown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return isAtBottomBeforeRender
}

const STEP_WAITING_TIME_MILLISEC = 2000

// A hook to get if the user scrolled at the bottom of the document.
// Returns a boolean stating if the user has at least once scrolled at the bottom of the document.
export function useHasScrolledOnceAtBottom(isShownOnlyWhenScrolledToBottom: boolean): boolean {
  const [hasScrolledOnceAtBottom, setHasScrolledOnceAtBottom] = useState(false)

  const onScroll = useCallback((): void => {
    if (computeIsAtBottom()) {
      setHasScrolledOnceAtBottom(true)
    }
  }, [])
  useEffect((): (() => void) => {
    if (hasScrolledOnceAtBottom || !isShownOnlyWhenScrolledToBottom) {
      return (): void => void 0
    }
    document.addEventListener('scroll', onScroll)
    const timeout = window.setInterval(onScroll, STEP_WAITING_TIME_MILLISEC)
    return (): void => {
      document.removeEventListener('scroll', onScroll)
      clearInterval(timeout)
    }
  }, [hasScrolledOnceAtBottom, isShownOnlyWhenScrolledToBottom, onScroll])

  return hasScrolledOnceAtBottom
}

export default useStayAtBottom

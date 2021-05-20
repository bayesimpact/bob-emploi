import {useCallback, useLayoutEffect, useEffect, useState} from 'react'

const getScrollPosition = (): number => window.scrollY ||
  window.pageYOffset ||
  document.body.scrollTop + (document.documentElement.scrollTop || 0)

const getMaxScrollPosition = (): number =>
  document.documentElement.offsetHeight - window.innerHeight

const computeIsAtBottom = (): boolean => getScrollPosition() >= getMaxScrollPosition()

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

export default useStayAtBottom

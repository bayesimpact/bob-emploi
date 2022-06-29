import type React from 'react'
import {useEffect, useState} from 'react'

interface Props {
  // Whether the detector is active. Defaults to true.
  isActive?: boolean
  // Whether the detector is only for the first appearance check, once visible, no need to warn.
  isForAppearing?: boolean
  // If the IntersectionObserver API is not available, fallback to this visibility.
  // Defaults to true.
  defaultVisibility?: boolean
  // The number of pixels at the top of the element that needs to be visible so that it is
  // considered as visible. Defaults to 0.
  minTopValue?: number
  // Function called when the visibility changes.
  onChange?: (isVisible: boolean) => void
}

const hasIntersectionObserver = !!IntersectionObserver

function useOnScreen<T extends HTMLElement>(ref: React.RefObject<T>, props: Props = {}): boolean {
  // TODO(pascal): Consider creating the ref in here.
  const {
    defaultVisibility = true, isActive = true, isForAppearing = false, minTopValue = 0,
    onChange,
  } = props
  const [isVisible, setIsVisible] = useState(hasIntersectionObserver ? false : defaultVisibility)
  const isStillActive = isActive && !(isForAppearing && isVisible)
  useEffect(() => {
    const currentDom = ref.current
    if (!hasIntersectionObserver || !isStillActive || !currentDom) {
      return () => void 0
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      {rootMargin: `0px 0px ${minTopValue}px`},
    )
    observer.observe(currentDom)
    return () => observer.unobserve(currentDom)
  }, [isStillActive, isForAppearing, minTopValue, onChange, ref])

  const finalIsVisible = isVisible || !isStillActive && isForAppearing

  useEffect(() => {
    onChange?.(finalIsVisible)
  }, [finalIsVisible, onChange])

  return finalIsVisible
}

export default useOnScreen

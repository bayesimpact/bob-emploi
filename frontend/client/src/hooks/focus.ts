import type React from 'react'
import {useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react'


export interface Focusable {
  focus: () => void
}


const useFocusableRefAs = <T extends Focusable>(ref?: React.Ref<Focusable>): React.RefObject<T> => {
  const finalRef = useRef<T>(null)
  useImperativeHandle(ref, (): Focusable => ({focus: () => finalRef.current?.focus()}))
  return finalRef
}


interface FocusHandlers {
  onBlur: () => void
  onFocus: () => void
}


// Hook to trigger a callback when the focus (document.activeElement) is leaving any element of the
// group without immediately focusing on another element of the group. By default a React onBlur
// handler on a container element would get called even if the focus switches between two elements
// inside that container.
//
// With this hook, you can add the onFocus, onBlur handlers to as many elements that you wish,
// including elements that are containers and wouldn't receive any focus themselves.
export const useOnGroupBlur = (onGroupBlur: () => void): FocusHandlers => {
  const [isFocused, setIsFocused] = useState(false)
  const [wasEverFocused, setWasEverFocused] = useState(false)
  const onFocus = useCallback(() => {
    setIsFocused(true)
    setWasEverFocused(true)
  }, [])
  const onBlur = useCallback(() => setIsFocused(false), [])
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!isFocused && wasEverFocused) {
        onGroupBlur()
      }
    }, 10)
    return () => window.clearTimeout(timeout)
  }, [isFocused, onGroupBlur, wasEverFocused])
  return {onBlur, onFocus}
}


export default useFocusableRefAs

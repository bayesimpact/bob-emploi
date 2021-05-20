import React, {useImperativeHandle, useRef} from 'react'


export interface Focusable {
  focus: () => void
}


const useFocusableRefAs = <T extends Focusable>(ref?: React.Ref<Focusable>): React.RefObject<T> => {
  const finalRef = useRef<T>(null)
  useImperativeHandle(ref, (): Focusable => ({focus: () => finalRef.current?.focus()}))
  return finalRef
}


export default useFocusableRefAs

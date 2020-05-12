import {useCallback, useEffect} from 'react'

// TODO(pascal): Consider moving to a different folder as there is no components here anymore.


type EventType = 'keydown' | 'keyup'

// Stacks of short key listeners. The ones entered last are tried first.
const keyListenerStack: {[K in EventType]: ((event: KeyboardEvent) => boolean)[]} =
  {keydown: [], keyup: []}

// Trigger all listeners in the stack until one returns false.
const handleKeyEvent = (eventType: EventType): ((event: KeyboardEvent) => void) =>
  (event: KeyboardEvent): void => {
    for (const handler of keyListenerStack[eventType]) {
      if (!handler(event)) {
        return
      }
    }
  }
const handleKeyEvents = {
  keydown: handleKeyEvent('keydown'),
  keyup: handleKeyEvent('keyup'),
} as const


interface KeyModifier {
  ctrl?: boolean
  shift?: boolean
}


function useKeyListener(
  keyCode: string, action?: () => void, modifiers?: KeyModifier, type: EventType = 'keyup'): void {

  const {ctrl = false, shift = false} = modifiers || {}

  const listener = useCallback((event: KeyboardEvent): boolean => {
    if (event.code === keyCode && event.ctrlKey === ctrl && event.shiftKey === shift) {
      action?.()
      return false
    }
    return true
  }, [keyCode, ctrl, shift, action])

  useEffect((): (() => void) => {
    if (!action) {
      return (): void => void 0
    }
    if (keyListenerStack[type].unshift(listener) === 1) {
      document.addEventListener(type, handleKeyEvents[type], false)
    }

    return (): void => {
      keyListenerStack[type].splice(keyListenerStack[type].indexOf(listener), 1)
      if (!keyListenerStack[type].length) {
        document.removeEventListener(type, handleKeyEvents[type], false)
      }
    }
  }, [action, listener, type])
}


export {useKeyListener}

import React from 'react'
import PropTypes from 'prop-types'


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


interface ShortKeyProps {
  children?: React.ReactNode
  hasCtrlModifier?: boolean
  hasShiftModifier?: boolean
  keyCode: string
  onKeyDown?: () => void
  onKeyUp?: () => void
}

type ShortKeyState = {
  [K in EventType]?: (event: KeyboardEvent) => boolean
}


// An invisible component that executes a function when a short-key is used.
// Some keys (like Escape) only trigger a "keydown" event whereas some
// combinations (like Ctrl+Shift+F) work better with a "keyup" event.
class ShortKey extends React.PureComponent<ShortKeyProps, ShortKeyState> {
  public static propTypes = {
    children: PropTypes.node,
    hasCtrlModifier: PropTypes.bool,
    hasShiftModifier: PropTypes.bool,
    keyCode: PropTypes.string.isRequired,
    // A function that is called if the short-key is going down, except if another ShortKey
    // component with the same short-key got called first.
    onKeyDown: PropTypes.func,
    // A function that is called if the short-key is going up, except if another ShortKey
    // component with the same short-key got called first.
    onKeyUp: PropTypes.func,
  }

  public state: ShortKeyState = {}

  public componentDidMount(): void {
    const {onKeyDown, onKeyUp} = this.props
    if (onKeyUp) {
      this.listenToEvent('keyup', onKeyUp)
    }
    if (onKeyDown) {
      this.listenToEvent('keydown', onKeyDown)
    }
  }

  public componentDidUpdate({onKeyDown: prevOnKeyDown, onKeyUp: prevOnKeyUp}: ShortKeyProps): void {
    const {onKeyDown, onKeyUp} = this.props
    if (onKeyUp !== prevOnKeyUp) {
      this.stopListeningToEvent('keyup')
      if (onKeyUp) {
        this.listenToEvent('keyup', onKeyUp)
      }
    }
    if (onKeyDown !== prevOnKeyDown) {
      this.stopListeningToEvent('keydown')
      if (onKeyDown) {
        this.listenToEvent('keydown', onKeyDown)
      }
    }
  }

  public componentWillUnmount(): void {
    this.stopListeningToEvent('keyup')
    this.stopListeningToEvent('keydown')
  }

  private listenToEvent = (eventType: EventType, onEvent: () => void): void => {
    const listener = (event: KeyboardEvent): boolean => {
      const {hasCtrlModifier, keyCode, hasShiftModifier} = this.props
      if (event.code === keyCode && event.ctrlKey === !!hasCtrlModifier &&
          event.shiftKey === !!hasShiftModifier) {
        onEvent()
        return false
      }
      return true
    }

    keyListenerStack[eventType].unshift(listener)
    if (keyListenerStack[eventType].length === 1) {
      document.addEventListener(eventType, handleKeyEvents[eventType], false)
    }
    this.setState({[eventType]: listener})
  }

  private stopListeningToEvent(eventType: EventType): void {
    const listener = this.state[eventType]
    if (!listener) {
      return
    }
    keyListenerStack[eventType].splice(keyListenerStack[eventType].indexOf(listener), 1)
    if (!keyListenerStack[eventType].length) {
      document.removeEventListener(eventType, handleKeyEvents[eventType], false)
    }
  }

  public render(): React.ReactNode {
    return this.props.children || null
  }
}


export {ShortKey}

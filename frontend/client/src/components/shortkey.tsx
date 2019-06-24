import React from 'react'
import PropTypes from 'prop-types'


// Stacks of short key listeners. The ones entered last are tried first.
const keyListenerStack = {keydown: [], keyup: []}

// Trigger all listeners in the stack until one returns false.
const handleKeyEvent = (eventType): ((event) => void) => (event): void => {
  for (var i = 0; i < keyListenerStack[eventType].length; ++i) {
    if (!keyListenerStack[eventType][i](event)) {
      return
    }
  }
}
const handleKeyEvents = {
  keydown: handleKeyEvent('keydown'),
  keyup: handleKeyEvent('keyup'),
}


interface ShortKeyProps {
  children?: React.ReactNode
  hasCtrlModifier?: boolean
  hasShiftModifier?: boolean
  keyCode: string
  onKeyDown?: () => void
  onKeyUp?: () => void
}


// An invisible component that executes a function when a short-key is used.
// Some keys (like Escape) only trigger a "keydown" event whereas some
// combinations (like Ctrl+Shift+F) work better with a "keyup" event.
class ShortKey extends React.PureComponent<ShortKeyProps> {
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

  private listenToEvent = (eventType, onEvent): void => {
    const listener = (event): boolean => {
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
    this.setState({[eventType + 'Listener']: listener})
  }

  private stopListeningToEvent(eventType): void {
    if (!this.state || !this.state[eventType + 'Listener']) {
      return
    }
    const listener = this.state[eventType + 'Listener']
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

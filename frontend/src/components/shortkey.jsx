import React from 'react'
import PropTypes from 'prop-types'


// Stacks of short key listeners. The ones entered last are tried first.
const keyListenerStack = {keydown: [], keyup: []}

// Trigger all listeners in the stack until one returns false.
const handleKeyEvent = eventType => event => {
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


// An invisible component that executes a function when a short-key is used.
// Some keys (like Escape) only trigger a "keydown" event whereas some
// combinations (like Ctrl+Shift+F) work better with a "keyup" event.
class ShortKey extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    hasCtrlModifier: PropTypes.bool,
    hasShiftModifier: PropTypes.bool,
    keyCode: PropTypes.string.isRequired,
    // A function that is called if the short-key is going down. If it returns
    // false, it will consume the event and other ShortKey components will not
    // get called. If it returns true other ShortKey components using the same
    // short-key will be called.
    onKeyDown: PropTypes.func,
    // A function that is called if the short-key is pressed. If it returns
    // false, it will consume the event and other ShortKey components will not
    // get called. If it returns true other ShortKey components using the same
    // short-key will be called.
    // TODO(pascal): Rename to onKeyUp if we confirm this works for what we
    // need.
    onKeyPress: PropTypes.func,
  }

  componentWillMount() {
    const {onKeyDown, onKeyPress} = this.props
    if (onKeyPress) {
      this.listenToEvent('keyup', onKeyPress)
    }
    if (onKeyDown) {
      this.listenToEvent('keydown', onKeyDown)
    }
  }

  componentWillReceiveProps(newProps) {
    const {onKeyDown, onKeyPress} = newProps
    if (onKeyPress !== this.props.onKeyPress) {
      this.stopListeningToEvent('keyup')
      if (onKeyPress) {
        this.listenToEvent('keyup', onKeyPress)
      }
    }
    if (onKeyDown !== this.props.onKeyDown) {
      this.stopListeningToEvent('keydown')
      if (onKeyDown) {
        this.listenToEvent('keydown', onKeyDown)
      }
    }
  }

  componentWillUnmount() {
    this.stopListeningToEvent('keyup')
    this.stopListeningToEvent('keydown')
  }

  listenToEvent = (eventType, onEvent) => {
    const listener = (event) => {
      const {hasCtrlModifier, keyCode, hasShiftModifier} = this.props
      if (event.code === keyCode && event.ctrlKey === !!hasCtrlModifier &&
          event.shiftKey === !!hasShiftModifier) {
        return onEvent()
      }
      return true
    }

    keyListenerStack[eventType].unshift(listener)
    if (keyListenerStack[eventType].length === 1) {
      document.addEventListener(eventType, handleKeyEvents[eventType], false)
    }
    this.setState({[eventType + 'Listener']: listener})
  }

  stopListeningToEvent(eventType) {
    if (!this.state || !this.state[eventType + 'Listener']) {
      return
    }
    const listener = this.state[eventType + 'Listener']
    keyListenerStack[eventType].splice(keyListenerStack[eventType].indexOf(listener), 1)
    if (!keyListenerStack[eventType].length) {
      document.removeEventListener(eventType, handleKeyEvents[eventType], false)
    }
  }

  render() {
    return this.props.children || null
  }
}


export {ShortKey}

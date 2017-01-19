import React from 'react'
import Radium from 'radium'

import {ShortKey} from './shortkey'
import {Colors, Icon, SmoothTransitions} from './theme'


// A right-hand pane that opens and closes smoothly.
class Pane extends React.Component {
  static propTypes = {
    // Content of the pane.
    children: React.PropTypes.node,
    // Whether the pane is shown.
    isShown: React.PropTypes.bool,
    // Callback when the pane is closed (X button is clicked).
    // X button will only be displayed if this function is provided.
    onClose: React.PropTypes.func,
    // Additional styling for the pane box.
    style: React.PropTypes.object,
    // Duration in milliseconds of the transition to open and close the pane.
    transitionDurationMilliSec: React.PropTypes.number,
  }

  static defaultProps = {
    transitionDurationMilliSec: 400,
  }

  state = {
    children: null,
    isContentShown: false,
    isTransitionOver: false,
  }

  show() {
    this.setState({isContentShown: true})
    clearTimeout(this.timeout)
    this.timeout = setTimeout(
        () => this.setState({isTransitionOver: true}),
        this.props.transitionDurationMilliSec)
  }

  hide() {
    // Keep the current children while disappearing.
    this.setState({children: this.props.children, isTransitionOver: false})
    clearTimeout(this.timeout)
    this.timeout = setTimeout(
        () => this.setState({children: null, isContentShown: false}),
        this.props.transitionDurationMilliSec)
  }

  componentWillMount() {
    if (this.props.isShown) {
      this.show()
    }
  }

  componentWillReceiveProps(nextProps) {
    const {isShown} = nextProps
    if (!!isShown !== !!this.props.isShown) {
      if (isShown) {
        this.show()
      } else {
        this.hide()
      }
    }
  }

  componentWillUnmount() {
    if (this.props.isShown) {
      this.hide()
    }
    clearTimeout(this.timeout)
  }

  render() {
    const {isShown, onClose, style, transitionDurationMilliSec} = this.props
    const {children, isContentShown, isTransitionOver} = this.state
    const pageStyle = {
      display: 'flex',
      height: '100vh',
      justifyContent: 'flex-end',
      opacity: isContentShown ? 1 : 0,
      overflow: 'hidden',
      position: 'fixed',
      right: 0,
      top: 0,
      width: isContentShown ? '100vw' : 0,
      zIndex: 1,
    }
    const backgroundStyle = {
      backgroundColor: '#000',
      bottom: 0,
      left: 0,
      opacity: isShown ? .5 : 0,
      position: 'absolute',
      right: 0,
      top: 0,
      transition: `opacity ${transitionDurationMilliSec}ms`,
      zIndex: 0,
    }
    const paneStyle = {
      backgroundColor: '#fff',
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.2)',
      color: Colors.GREYISH_BROWN,
      fontSize: 19,
      lineHeight: 1.7,
      opacity: isShown ? 1 : 0,
      position: 'relative',
      // The transform property creates a new local coordinate system which
      // breaks nested modals or other properties using "fixed" so we get rid
      // of it as soon as the transition is over.
      // https://www.w3.org/TR/css-transforms-1/#transform-rendering
      transform: isTransitionOver ? 'initial' : (
        `translate(${isShown ? '0%' : '100%'}, 0)`),
      transition: `all ${transitionDurationMilliSec}ms`,
      ...style,
    }
    const contentStyle = {
      bottom: 0,
      left: 0,
      overflow: 'auto',
      position: 'absolute',
      right: 0,
      top: 0,
    }
    return <div style={pageStyle}>
      <div style={backgroundStyle} onClick={onClose} />
      <div style={paneStyle}>
        {onClose ? <PaneCloseButton onClose={onClose} /> : null}
        <div style={contentStyle}>
          {isContentShown ? (children || this.props.children) : null}
        </div>
      </div>
    </div>
  }
}


class PaneCloseButtonBase extends React.Component {
  static propTypes = {
    onClose: React.PropTypes.func.isRequired,
  }

  render() {
    const {onClose} = this.props
    const style = {
      ':hover': {
        backgroundColor: Colors.SLATE,
      },
      alignItems: 'center',
      backgroundColor: Colors.CHARCOAL_GREY,
      borderRadius: '3px 0 0 3px',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      fontSize: 18,
      height: 48,
      justifyContent: 'center',
      position: 'absolute',
      right: '100%',
      top: 20,
      width: 48,
      ...SmoothTransitions,
    }
    return <div style={style} onClick={onClose} ref="close">
      <ShortKey keyCode="Escape" onKeyDown={onClose} />
      <Icon name="close" />
    </div>
  }
}
const PaneCloseButton = Radium(PaneCloseButtonBase)


export {Pane}

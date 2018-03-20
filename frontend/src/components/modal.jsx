import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import ReactHeight from 'react-height'

import {Colors, SmoothTransitions} from './theme'
import {ShortKey} from 'components/shortkey'


var numModalsShown = 0


class Modal extends React.Component {
  static propTypes = {
    // Opacity of the black cover on the backround.
    backgroundCoverOpacity: PropTypes.number.isRequired,
    // Content of the modal box.
    children: PropTypes.node,
    // Children to set on top of the semi-opaque background but outside of the
    // modal box.
    externalChildren: PropTypes.node,
    // Whether the modal is shown.
    isShown: PropTypes.bool,
    // Callback when the modal is closed (X button is clicked).
    // X button will only be displayed if this function is provided.
    onClose: PropTypes.func,
    // Callback when the modals finishes the hide transition.
    onHidden: PropTypes.func,
    // Additional styling for the modal box.
    style: PropTypes.object,
    title: PropTypes.node,
    // Additionl styling for the title.
    titleStyle: PropTypes.object,
  }

  static defaultProps = {
    backgroundCoverOpacity: .5,
    transitionDurationMilliSec: 450,
  }

  state = {
    children: null,
    closeButtonHeight: 0,
    isContentShown: false,
    isTooBigToBeCentered: false,
    isTransitionOver: false,
    modalHeight: 0,
    onTransitionEnd: null,
  }

  componentWillMount() {
    const {isShown} = this.props
    if (isShown) {
      this.show()
    }
  }

  componentWillReceiveProps(nextProps) {
    const {isShown} = nextProps
    if (!!isShown !== !!this.props.isShown) {
      if (isShown) {
        this.show()
      } else {
        this.hide(nextProps.onHidden)
      }
    }
  }

  componentWillUnmount() {
    const {isShown} = this.props
    if (isShown) {
      this.hide(this.props.onHidden)
    }
  }

  // Update the state after the transition ends.
  // If there's no transition return directly the modifications of the state.
  setStateOnTransitionEnd(computeState) {
    const {style} = this.props
    if (style && style.transition === 'none') {
      return computeState()
    }
    return {
      onTransitionEnd: () => this.setState(computeState()),
    }
  }

  show() {
    if (!numModalsShown++) {
      // Disable scroll on body.
      document.body.style.overflow = 'hidden'
    }
    this.setState({
      isContentShown: true,
      ...this.setStateOnTransitionEnd(() => ({isTransitionOver: true})),
    })
  }

  hide(onHidden) {
    if (!--numModalsShown) {
      // Re-enable scroll on body.
      document.body.style.overflow = 'visible'
    }
    // Keep the current children while disappearing.
    this.setState({
      children: this.props.children,
      isTransitionOver: false,
      ...this.setStateOnTransitionEnd(() => {
        this.resetScroll()
        onHidden && onHidden()
        return {
          children: null,
          isContentShown: false,
          onTransitionEnd: null,
        }
      }),
    })
  }

  handleUpdatedHeight = newHeight => {
    const closeButtonHeight = this.props.onClose ? 30 : 0
    const maxHeight = window.innerHeight - closeButtonHeight
    this.setState({
      closeButtonHeight,
      isTooBigToBeCentered: newHeight && newHeight > maxHeight,
      modalHeight: newHeight,
    })
  }

  resetScroll() {
    if (!this.page) {
      return
    }
    this.page.scrollTop = 0
  }

  render() {
    const {backgroundCoverOpacity, externalChildren, isShown, onClose, style, title} = this.props
    const {children, closeButtonHeight, isContentShown, isTooBigToBeCentered,
      isTransitionOver, modalHeight, onTransitionEnd} = this.state
    const pageStyle = {
      alignItems: 'center',
      display: isTooBigToBeCentered ? 'block' : 'flex',
      height: isContentShown ? '100vh' : '0',
      justifyContent: 'center',
      left: 0,
      opacity: isContentShown ? 1 : 0,
      overflow: isTooBigToBeCentered ? 'scroll' : 'hidden',
      position: 'fixed',
      textAlign: isTooBigToBeCentered ? 'center' : 'initial',
      top: 0,
      width: '100vw',
      zIndex: 2,
    }
    const modalStyle = {
      backgroundColor: '#fff',
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.2)',
      color: Colors.GREYISH_BROWN,
      display: isTooBigToBeCentered ? 'inline-block' : 'block',
      fontSize: 19,
      height: isTooBigToBeCentered ? modalHeight : 'initial',
      lineHeight: 1.7,
      margin: isTooBigToBeCentered ? closeButtonHeight + 'px auto' : 'initial',
      opacity: isShown ? 1 : 0,
      position: 'relative',
      textAlign: 'left',
      // The transform property creates a new local coordinate system which
      // breaks nested modals or other properties using "fixed" so we get rid
      // of it as soon as the transition is over.
      // https://www.w3.org/TR/css-transforms-1/#transform-rendering
      transform: isTransitionOver ? 'initial' : (
        'translate(0, ' + (isShown ? '0px' : '-40px') + ')'),
      transition: 'all 450ms',
      ...style,
    }
    const backgroundStyle = {
      backgroundColor: '#000',
      bottom: isTooBigToBeCentered ? 'initial' : 0,
      height: isTooBigToBeCentered ? (modalHeight + 2 * closeButtonHeight) : '100vh',
      left: 0,
      opacity: isShown ? backgroundCoverOpacity : 0,
      position: 'absolute',
      right: 0,
      top: 0,
      transition: modalStyle.transition,
      zIndex: 0,
    }
    const titleStyle = {
      color: Colors.DARK,
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: 0.6,
      lineHeight: 1.3,
      margin: '40px 27px 0',
      textAlign: 'center',
      ...this.props.titleStyle,
    }
    return <div
      ref={page => this.page = page}
      style={pageStyle}
    >
      <div style={backgroundStyle} />
      {externalChildren}
      <ReactHeight
        onHeightReady={this.handleUpdatedHeight} style={modalStyle}
        onTransitionEnd={onTransitionEnd}>
        {title ? <div style={titleStyle}>{title}</div> : null}
        {onClose ? <ModalCloseButton shouldCloseOnEscape={isShown} onClick={onClose} /> : null}
        {isContentShown ? (children || this.props.children) : null}
      </ReactHeight>
    </div>
  }
}


class ModalCloseButtonBase extends React.Component {
  static propTypes = {
    onClick: PropTypes.func.isRequired,
    shouldCloseOnEscape: PropTypes.bool,
    style: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {shouldCloseOnEscape, onClick, style, ...otherProps} = this.props
    const {isMobileVersion} = this.context
    const closeButtonStyle = {
      ':hover': {
        backgroundColor: Colors.SLATE,
      },
      alignItems: 'center',
      backgroundColor: Colors.CHARCOAL_GREY,
      borderRadius: '100%',
      bottom: '100%',
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.5)',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      fontSize: 19,
      height: 35,
      justifyContent: 'center',
      position: 'absolute',
      right: isMobileVersion ? 5 : 0,
      transform: 'translate(50%, 50%)',
      width: 35,
      zIndex: 1,
      ...SmoothTransitions,
      ...style,
    }
    const closeIconStyle = {
      fill: closeButtonStyle.color,
      height: 33,
      width: 19,
    }
    return <div {...otherProps} style={closeButtonStyle} onClick={onClick}>
      <ShortKey keyCode="Escape" onKeyDown={shouldCloseOnEscape ? onClick : null} />
      <CloseIcon style={closeIconStyle} />
    </div>
  }
}
const ModalCloseButton = Radium(ModalCloseButtonBase)


class ModalHeader extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.SLATE,
      color: '#fff',
      display: 'flex',
      fontSize: 15,
      fontWeight: 500,
      lineHeight: 1.47,
      minHeight: 90,
      padding: '0 35px',
      width: '100%',
      ...this.props.style,
    }
    return <div style={style}>
      {this.props.children}
    </div>
  }
}


export {Modal, ModalHeader, ModalCloseButton}

import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import ReactHeight from 'react-height'

import {isMobileVersion} from 'components/mobile'
import {ShortKey} from 'components/shortkey'

// TODO(pascal): Harmonize how we import components from other components.
import {SmoothTransitions} from './theme'


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
    isFullyShown: false,
    isShown: false,
    isTooBigToBeCentered: false,
    modalHeight: 0,
  }

  static getDerivedStateFromProps({children, isShown, style}, {isShown: wasShown}) {
    const hasTransition = style && style.transition !== 'none'
    if (!wasShown !== !isShown) {
      return {
        // Keep the current children while appearing/disappearing.
        children: (hasTransition || isShown) ? children : null,
        hasTransition,
        isContentShown: hasTransition || isShown,
        isFullyShown: !hasTransition,
        isShown,
      }
    }
    return null
  }

  componentDidMount() {
    const {isShown} = this.props
    if (isShown) {
      this.show()
    }
  }

  componentDidUpdate({isShown: wasShown}) {
    const {isShown, onHidden} = this.props
    if (isShown && !wasShown) {
      this.show()
    } else if (!isShown && wasShown) {
      this.hide()
      if (!this.state.hasTransition) {
        onHidden && onHidden()
      }
    }
  }

  componentWillUnmount() {
    const {isShown, onHidden} = this.props
    if (isShown) {
      this.hide()
      onHidden && onHidden()
    }
  }

  show() {
    if (!numModalsShown++) {
      // Disable scroll on body.
      document.body.style.overflow = 'hidden'
    }
  }

  hide() {
    if (!--numModalsShown) {
      // Re-enable scroll on body.
      document.body.style.overflow = 'visible'
    }
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

  handleTransitionEnd = () => {
    const {isShown, hasTransition} = this.state
    if (!hasTransition) {
      // Weird cases.
      return
    }
    if (isShown) {
      this.setState({children: null, isFullyShown: true})
    } else {
      this.resetScroll()
      const {onHidden} = this.props
      onHidden && onHidden()
      this.setState({
        children: null,
        isContentShown: false,
      })
    }
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
      isFullyShown, modalHeight} = this.state
    const pageStyle = {
      alignItems: 'center',
      display: isTooBigToBeCentered ? 'block' : 'flex',
      fontFamily: style && style.fontFamily || 'inherit',
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
      color: colors.GREYISH_BROWN,
      display: isTooBigToBeCentered ? 'inline-block' : 'block',
      fontSize: 19,
      lineHeight: 1.7,
      margin: isTooBigToBeCentered ? `${closeButtonHeight}px auto` : 'initial',
      opacity: isShown ? 1 : 0,
      position: 'relative',
      textAlign: 'left',
      // The transform property creates a new local coordinate system which
      // breaks nested modals or other properties using "fixed" so we get rid
      // of it as soon as the transition is over.
      // https://www.w3.org/TR/css-transforms-1/#transform-rendering
      transform: isFullyShown ? 'initial' : (
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
      color: colors.DARK,
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
        onTransitionEnd={this.handleTransitionEnd}>
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

  render() {
    const {shouldCloseOnEscape, onClick, style, ...otherProps} = this.props
    const closeButtonStyle = {
      ':hover': {
        backgroundColor: colors.SLATE,
      },
      alignItems: 'center',
      backgroundColor: colors.CHARCOAL_GREY,
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
      backgroundColor: colors.SLATE,
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

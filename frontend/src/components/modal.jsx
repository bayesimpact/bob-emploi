import React from 'react'
import Radium from 'radium'
import ReactHeight from 'react-height'

import {Colors, Icon, Button, SmoothTransitions, Styles} from './theme'
import {ShortKey} from 'components/shortkey'


var numModalsShown = 0

const closeButtonHeight = 30


class Modal extends React.Component {
  static propTypes = {
    // Opacity of the black cover on the backround.
    backgroundCoverOpacity: React.PropTypes.number.isRequired,
    // Content of the modal box.
    children: React.PropTypes.node,
    // Children to set on top of the semi-opaque background but outside of the
    // modal box.
    externalChildren: React.PropTypes.node,
    // Whether the modal is shown.
    isShown: React.PropTypes.bool,
    // Callback when the modal is closed (X button is clicked).
    // X button will only be displayed if this function is provided.
    onClose: React.PropTypes.func,
    // Callback when the modals finishes the hide transition.
    onHidden: React.PropTypes.func,
    // Additional styling for the modal box.
    style: React.PropTypes.object,
    title: React.PropTypes.node,
    // Additionl styling for the title.
    titleStyle: React.PropTypes.object,
    // Duration in milliseconds of the transition to open and close the modal.
    transitionDurationMilliSec: React.PropTypes.number,
  }

  static defaultProps = {
    backgroundCoverOpacity: .5,
    transitionDurationMilliSec: 450,
  }

  state = {
    children: null,
    isContentShown: false,
    isTooBigToBeCentered: false,
    isTransitionOver: false,
    modalHeight: 0,
  }

  show() {
    if (!numModalsShown++) {
      // Disable scroll on body.
      document.body.style.overflow = 'hidden'
    }
    this.setState({isContentShown: true})
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.timeout = setTimeout(
        () => this.setState({isTransitionOver: true}),
        this.props.transitionDurationMilliSec)
  }

  hide(onHidden) {
    if (!--numModalsShown) {
      // Re-enable scroll on body.
      document.body.style.overflow = 'visible'
    }
    // Keep the current children while disappearing.
    this.setState({children: this.props.children, isTransitionOver: false})
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.timeout = setTimeout(
        () => {
          this.setState({children: null, isContentShown: false})
          onHidden && onHidden()
        },
        this.props.transitionDurationMilliSec)
  }

  componentWillMount() {
    const {isShown} = this.props
    if (isShown) {
      this.show()
    }
  }

  handleUpdatedHeight = newHeight => {
    const maxHeight = window.innerHeight - (this.props.onClose ? closeButtonHeight : 0)
    this.setState({
      isTooBigToBeCentered: newHeight && newHeight > maxHeight,
      modalHeight: newHeight,
    })
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
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  render() {
    const {backgroundCoverOpacity, externalChildren, isShown, onClose, style, title,
           transitionDurationMilliSec} = this.props
    const {children, isContentShown, isTooBigToBeCentered, isTransitionOver,
           modalHeight} = this.state
    const pageStyle = {
      alignItems: 'center',
      display: isTooBigToBeCentered ? 'block' : 'flex',
      height: isContentShown ? '100vh' : '0',
      justifyContent: 'center',
      left: 0,
      opacity: isContentShown ? 1 : 0,
      overflow: isTooBigToBeCentered ? 'scroll' : 'hidden',
      position: 'fixed',
      top: 0,
      width: '100vw',
      zIndex: 1,
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
      transition: `opacity ${transitionDurationMilliSec}ms`,
      zIndex: 0,
    }
    const modalStyle = {
      backgroundColor: '#fff',
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.2)',
      color: Colors.GREYISH_BROWN,
      fontSize: 19,
      height: isTooBigToBeCentered ? modalHeight : 'initial',
      lineHeight: 1.7,
      margin: isTooBigToBeCentered ? closeButtonHeight + 'px auto' : 'initial',
      opacity: isShown ? 1 : 0,
      position: 'relative',
      // The transform property creates a new local coordinate system which
      // breaks nested modals or other properties using "fixed" so we get rid
      // of it as soon as the transition is over.
      // https://www.w3.org/TR/css-transforms-1/#transform-rendering
      transform: isTransitionOver ? 'initial' : (
        'translate(0, ' + (isShown ? '0px' : '-40px') + ')'),
      transition: `all ${transitionDurationMilliSec}ms`,
      ...style,
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
    return <div style={pageStyle}>
      <div style={backgroundStyle} />
      {externalChildren}
      <ReactHeight onHeightReady={this.handleUpdatedHeight} style={modalStyle}>
        {title ? <div style={titleStyle}>{title}</div> : null}
        {onClose ? <ModalCloseButton closeOnEscape={isShown} onClick={onClose} /> : null}
        {isContentShown ? (children || this.props.children) : null}
      </ReactHeight>
    </div>
  }
}


class ModalCloseButtonBase extends React.Component {
  static propTypes = {
    closeOnEscape: React.PropTypes.bool,
    onClick: React.PropTypes.func.isRequired,
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool.isRequired,
  }

  render() {
    const {closeOnEscape, onClick, style, ...otherProps} = this.props
    const {isMobileVersion} = this.context
    const closeButtonStyle = {
      ':hover': {
        backgroundColor: Colors.SLATE,
      },
      alignItems: 'center',
      backgroundColor: Colors.CHARCOAL_GREY,
      borderRadius: '100%',
      bottom: '100%',
      boxShadow: '0 3px 5px 0 rgba(0, 0, 0, 0.4)',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      fontSize: 19,
      height: 35,
      justifyContent: 'center',
      position: 'absolute',
      right: isMobileVersion ? 25 : 0,
      transform: 'translate(50%, 50%)',
      width: 35,
      zIndex: 1,
      ...SmoothTransitions,
      ...style,
    }
    return <div {...otherProps} style={closeButtonStyle} onClick={onClick}>
      <ShortKey keyCode="Escape" onKeyDown={closeOnEscape ? onClick : null} />
      <Icon name="close" />
    </div>
  }
}
const ModalCloseButton = Radium(ModalCloseButtonBase)


class ModalHeader extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    style: React.PropTypes.object,
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


class GamificationModal extends React.Component {
  static propTypes = {
    buttonText: React.PropTypes.string.isRequired,
    children: React.PropTypes.node.isRequired,
    imageSrc: React.PropTypes.string.isRequired,
    isShown: React.PropTypes.bool,
    onClose: React.PropTypes.func.isRequired,
    title: React.PropTypes.string.isRequired,
  }

  render() {
    const {buttonText, children, imageSrc, isShown, onClose, title} = this.props
    const style = {
      borderRadius: 10,
      boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.5)',
      padding: '0 60px 55px',
      ...Styles.CENTERED_COLUMN,
    }
    const textBoxStyle = {
      color: Colors.DARK_TWO,
      fontSize: 15,
      lineHeight: 1.53,
      marginTop: 40,
      textAlign: 'center',
      width: 355 ,
    }
    return <Modal style={style} isShown={isShown} title={title}>
      <img style={{height: 98, marginTop: 40, width: 98}} src={imageSrc} />
      <div style={textBoxStyle}>{children}</div>
      <Button style={{marginTop: 42}} type="validation" onClick={onClose}>
        {buttonText}
      </Button>
    </Modal>
  }
}


export {Modal, ModalHeader, ModalCloseButton, GamificationModal}

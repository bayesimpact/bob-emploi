import PropTypes from 'prop-types'
import React from 'react'

import {ModalCloseButton} from 'components/modal'
import {Button, Colors, SmoothTransitions} from 'components/theme'


class InfoCollNotificationBox extends React.Component {
  static propTypes = {
    isShown: PropTypes.bool,
    onClose: PropTypes.func,
    style: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    isHiding: false,
  }

  close = () => {
    const {onClose} = this.props
    this.setState({isHiding: true})
    if (onClose) {
      // Wait for the end of the transition to close it.
      setTimeout(onClose, 500)
    }
  }

  handleClick = () => {
    window.open('https://projects.invisionapp.com/boards/SK39VCS276T8J/', '_blank')
    this.close()
  }

  render() {
    const {isShown, onClose, style} = this.props
    const {isHiding} = this.state
    const isVisible = isShown && !isHiding
    const {isMobileVersion} = this.context
    if (isMobileVersion) {
      return null
    }
    const containerStyle = {
      backgroundColor: Colors.BOB_BLUE,
      borderRadius: 4,
      bottom: 20,
      boxShadow: '0 3px 14px 0 rgba(0, 0, 0, 0.2)',
      color: '#fff',
      fontSize: 15,
      left: 20,
      lineHeight: 1.3,
      opacity: isVisible ? 1 : 0,
      padding: '25px 40px 25px 25px',
      position: 'fixed',
      textAlign: 'left',
      transform: `translateX(${isVisible ? '0' : '-100%'})`,
      ...SmoothTransitions,
      ...style,
    }
    const closeStyle = {
      bottom: 'initial',
      fontSize: 10,
      height: 15,
      opacity: .6,
      right: 10,
      top: 10,
      transform: 'initial',
      width: 15,
    }
    const buttonStyle = {
      ':hover': {
        backgroundColor: '#fff',
      },
      backgroundColor: 'rgba(255, 255, 255, .8)',
      color: Colors.BOB_BLUE,
      display: 'block',
      marginTop: 25,
    }
    return <div style={containerStyle}>
      {onClose ? <ModalCloseButton onClick={this.close} style={closeStyle} /> : null}
      <strong>Vous êtes un conseiller Pôle emploi&nbsp;?</strong><br />
      Trouvez ici nos ressources pour présenter Bob
      <Button style={buttonStyle} onClick={this.handleClick}>Voir les ressources</Button>
    </div>
  }
}


export {InfoCollNotificationBox}

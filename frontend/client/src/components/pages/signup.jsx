import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {closeLoginModal} from 'store/actions'

import {LoginMethods} from 'components/login'
import {ModalCloseButton} from 'components/modal'


class SignUpPageBase extends React.Component {
  static propTypes = {
    canCloseModal: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
  }

  componentWillUnmount() {
    this.props.dispatch(closeLoginModal())
  }

  render() {
    const {canCloseModal, dispatch} = this.props
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
    }
    const closeButtonStyle = {
      backgroundColor: colors.PINKISH_GREY,
      boxShadow: 0,
      right: 20,
      top: 20,
      transform: 'initial',
    }
    return <div style={containerStyle}>
      {canCloseModal ? <ModalCloseButton
        style={closeButtonStyle} onClick={() => dispatch(closeLoginModal(true))} /> : null}
      <LoginMethods />
    </div>
  }
}
const SignUpPage = connect(({app: {loginModal}}) => ({
  canCloseModal: loginModal && !loginModal.resetToken,
}))(SignUpPageBase)


export {SignUpPage}

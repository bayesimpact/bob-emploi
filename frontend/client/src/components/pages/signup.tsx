import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, closeLoginModal} from 'store/actions'

import {LoginMethods} from 'components/login'
import {ModalCloseButton} from 'components/modal'


interface ConnectedProps {
  canCloseModal: boolean
}


interface Props extends ConnectedProps {
  children?: never
  dispatch: DispatchAllActions
}


class SignUpPageBase extends React.PureComponent<Props> {
  public static propTypes = {
    canCloseModal: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
  }

  public componentWillUnmount(): void {
    this.props.dispatch(closeLoginModal())
  }

  private handleCloseModal = (): void => {
    this.props.dispatch(closeLoginModal(true))
  }

  public render(): React.ReactNode {
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
    }
    const closeButtonStyle: React.CSSProperties = {
      backgroundColor: colors.PINKISH_GREY,
      boxShadow: 'unset',
      right: 20,
      top: 20,
      transform: 'initial',
    }
    return <div style={containerStyle}>
      {this.props.canCloseModal ? <ModalCloseButton
        style={closeButtonStyle} onClick={this.handleCloseModal} /> : null}
      <LoginMethods />
    </div>
  }
}
const SignUpPage = connect(({app: {loginModal}}: RootState): ConnectedProps => ({
  canCloseModal: loginModal && !(loginModal.defaultValues && loginModal.defaultValues.resetToken),
}))(SignUpPageBase)


export {SignUpPage}

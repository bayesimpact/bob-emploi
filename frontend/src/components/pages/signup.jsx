import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'

import {closeLoginModal, openLoginModal} from 'store/actions'
import {LoginMethods} from 'components/login'
import {Routes} from 'components/url'


class SignUpPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isUserSignedIn: PropTypes.bool,
    shouldLoginModalBeOpened: PropTypes.bool,
  }

  // In desktop loginModal is expected to be opened.
  // Here, for mobile, if it is not set, we set it.
  componentDidMount() {
    const {dispatch, shouldLoginModalBeOpened} = this.props
    if (shouldLoginModalBeOpened) {
      dispatch(openLoginModal({}, ''))
    }
  }

  componentWillUnmount() {
    this.props.dispatch(closeLoginModal())
  }

  render() {
    if (this.props.isUserSignedIn) {
      return <Redirect to={Routes.ROOT} />
    }
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
    }
    return <div style={containerStyle}>
      <LoginMethods />
    </div>
  }
}
const SignUpPage = connect(({app: {loginModal}, user: {userId}}) => ({
  isUserSignedIn: !!userId,
  shouldLoginModalBeOpened: !loginModal,
}))(SignUpPageBase)


export {SignUpPage}

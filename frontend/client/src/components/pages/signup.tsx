import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React from 'react'
import {connect} from 'react-redux'
import {Redirect, RouteComponentProps, withRouter} from 'react-router'

import {DispatchAllActions, RootState, closeLoginModal, loginUserFromToken, openLoginModal,
  openRegistrationModal} from 'store/actions'

import {LoginMethods} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {ModalCloseButton} from 'components/modal'
import {Routes, SIGNUP_HASH} from 'components/url'

import {WaitingPage} from './waiting'


interface ConnectedProps {
  canCloseModal: boolean
  hasLoginModal: boolean
}


interface Props extends RouteComponentProps, ConnectedProps {
  children?: never
  dispatch: DispatchAllActions
}


interface State {
  hasLoginModal?: boolean
  shouldRedirect?: boolean
}
class SignUpPageBase extends React.PureComponent<Props, State> {
  public static propTypes = {
    canCloseModal: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
  }

  public state: State = {}

  public static getDerivedStateFromProps(
    {hasLoginModal}: Props,
    {hasLoginModal: hadLoginModal}: State): State {
    if (!hasLoginModal === !hadLoginModal) {
      return null
    }
    return {
      hasLoginModal,
      ...hasLoginModal ? {} : {shouldRedirect: true},
    }
  }

  public componentDidMount(): void {
    const {dispatch, hasLoginModal, location: {hash, search}} = this.props
    if (isMobileVersion && hasLoginModal) {
      return
    }
    const {authToken, email = '', resetToken, state, userId: userId} = parse(search)
    if (hash === SIGNUP_HASH) {
      dispatch(openRegistrationModal({email}, 'urlHash'))
      return
    }
    if (resetToken) {
      dispatch(openLoginModal({email, resetToken}, 'resetpassword'))
      return
    }
    if (state) {
      dispatch(openLoginModal({email}, 'redirect-connect'))
      return
    }
    if (userId && authToken) {
      dispatch(loginUserFromToken(userId, authToken))
      return
    }
    dispatch(openLoginModal({email}, 'returninguser'))
  }

  public componentDidUpdate(unusedPrevProps, {shouldRedirect: prevShouldRedirect}): void {
    const {history, location: {pathname}} = this.props
    const {shouldRedirect} = this.state
    if (!prevShouldRedirect && shouldRedirect && pathname === Routes.SIGNUP_PAGE) {
      history.goBack()
    }
  }

  public componentWillUnmount(): void {
    if (this.props.hasLoginModal) {
      this.props.dispatch(closeLoginModal())
    }
  }

  private handleClick = (): void => {
    this.props.dispatch(closeLoginModal())
  }

  private renderMobile(): React.ReactNode {
    const {canCloseModal} = this.props
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
      {canCloseModal ? <ModalCloseButton
        style={closeButtonStyle} onClick={this.handleClick} /> : null}
      <LoginMethods onLogin={this.handleClick} />
    </div>
  }

  public render(): React.ReactNode {
    if (this.state.shouldRedirect) {
      const {location: {hash, pathname, search}} = this.props
      const to = pathname === Routes.SIGNUP_PAGE || hash || search ? pathname : Routes.ROOT
      return <Redirect to={to} />
    }
    if (isMobileVersion) {
      return this.renderMobile()
    }
    return <WaitingPage />
  }
}
const SignUpPage = connect(({app: {loginModal}}: RootState): ConnectedProps => ({
  canCloseModal: loginModal && !(loginModal.defaultValues && loginModal.defaultValues.resetToken),
  hasLoginModal: !!loginModal,
}))(withRouter(SignUpPageBase))


export {SignUpPage}

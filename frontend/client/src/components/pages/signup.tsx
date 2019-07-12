import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React from 'react'
import {connect} from 'react-redux'
import {Redirect, RouteComponentProps, withRouter} from 'react-router'

import {DispatchAllActions, RootState, closeLoginModal, loginUserFromToken, openLoginModal,
  openRegistrationModal} from 'store/actions'
import {YouChooser} from 'store/french'

import {LoginButton, LoginMethods} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {ModalCloseButton} from 'components/modal'
import {Routes, SIGNUP_HASH} from 'components/url'
import bobHeadImage from 'images/bob-head.svg'

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
    const {dispatch} = this.props
    dispatch(closeLoginModal())
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


interface BannerProps {
  onClose?: () => void
  userYou: YouChooser
  style?: React.CSSProperties
}


interface BannerState {
  isShown?: boolean
}


class SignUpBanner extends React.Component<BannerProps, BannerState> {
  public static propTypes = {
    onClose: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    isShown: true,
  }

  private handleClose = (): void => {
    const {onClose} = this.props
    this.setState({isShown: false})
    onClose && onClose()
  }

  public render(): React.ReactNode {
    const {style, userYou} = this.props
    const {isShown} = this.state
    if (!isShown) {
      // TODO(pascal): Add a transition when hiding the banner.
      return null
    }
    const bannerStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: isMobileVersion ? `solid 2px ${colors.SILVER}` : 'initial',
      borderRadius: 10,
      boxShadow: isMobileVersion ? 'initial' : '0 4px 14px 0 rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      paddingBottom: isMobileVersion ? 20 : 0,
      paddingRight: isMobileVersion ? 0 : 40,
      position: 'relative',
      textAlign: isMobileVersion ? 'center' : 'left',
      ...style,
      ...(isMobileVersion ? {width: 'calc(100vw - 30px)'} : {}),
    }
    const textBannerStyle: React.CSSProperties = {
      fontSize: 18,
      fontStyle: 'italic',
      padding: isMobileVersion ? 20 : '33px 32px 35px',
    }
    const closeStyle: React.CSSProperties = {
      backgroundColor: colors.SLATE,
      boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.2)',
      color: '#fff',
      fontSize: 12,
      height: 35,
      width: 35,
    }
    return <div style={bannerStyle}>
      <ModalCloseButton onClick={this.handleClose} style={closeStyle} />
      {isMobileVersion ? null :
        <img src={bobHeadImage} alt="" style={{marginLeft: 32, width: 56}} />}
      <span style={textBannerStyle} >
        Pense{userYou('', 'z')} à {isMobileVersion ? null : <React.Fragment>
          créer {userYou('ton', 'votre')} compte pour
        </React.Fragment>}
        sauvegarder {userYou('ta', 'votre')} progression
      </span>
      <span style={{flex: 1}}></span>
      <LoginButton
        type="navigation" isRound={true} visualElement="diagnostic">
        Créer mon compte
      </LoginButton>
    </div>
  }
}


export {SignUpBanner, SignUpPage}

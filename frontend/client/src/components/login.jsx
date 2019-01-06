import _omit from 'lodash/omit'
import AccountOutlineIcon from 'mdi-react/AccountOutlineIcon'
import EmailOutlineIcon from 'mdi-react/EmailOutlineIcon'
import GoogleIcon from 'mdi-react/GoogleIcon'
import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {withRouter} from 'react-router'
import {Link, Redirect} from 'react-router-dom'
import {parse, stringify} from 'query-string'

import FacebookLogin from 'react-facebook-login'
import GoogleLogin from 'react-google-login'

import linkedInIcon from 'images/linked-in.png'
import peConnectIcon from 'images/pole-emploi-connect.svg'
import signupCoverImage from 'images/signup-cover.jpg?multi&sizes[]=1440&sizes[]=600'

import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {validateEmail} from 'store/validations'
import {facebookAuthenticateUser, googleAuthenticateUser, emailCheck,
  registerNewUser, loginUser, displayToasterMessage, resetPassword, peConnectAuthenticateUser,
  askPasswordReset, openLoginModal, openRegistrationModal, closeLoginModal,
  linkedInAuthenticateUser, AUTHENTICATE_USER, EMAIL_CHECK,
  RESET_USER_PASSWORD} from 'store/actions'
import {CircularProgress, chooseImageVersion, colorToAlpha, IconInput,
  LabeledToggle, Button, Styles} from 'components/theme'
import {Modal, ModalCloseButton} from 'components/modal'
import {Routes} from 'components/url'


class LoginFormBase extends React.Component {
  static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isAskingForPasswordReset: PropTypes.bool,
    isAuthenticatingEmail: PropTypes.bool,
    isAuthenticatingOther: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    onShowRegistrationFormClick: PropTypes.func.isRequired,
  }

  state = {
    email: this.props.defaultEmail || '',
    hashSalt: '',
    isTryingToResetPassword: false,
    password: '',
    passwordResetRequestedEmail: null,
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  handleLogin = event => {
    const {dispatch} = this.props
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!this.isFormValid()) {
      return
    }
    dispatch(emailCheck(this.state.email)).
      then(response => {
        if (response && response.hashSalt) {
          this.setState({hashSalt: response.hashSalt})
        }
        return response
      }).
      then(response => {
        if (!response) {
          return response
        }
        if (response.isNewUser) {
          // TODO: Emphasize to registration form if response.isNewUser
          dispatch(displayToasterMessage("L'utilisateur n'existe pas."))
          return
        }
        const {email, password, hashSalt} = this.state
        // TODO: Use different API endpoints for login and registration.
        dispatch(loginUser(email, password, hashSalt)).then(response => {
          if (response && response.authenticatedUser) {
            this.props.onLogin(response.authenticatedUser)
            // TODO: Take care of the else case when the authentication was
            // not successful but we got back some new salt. (response.hashSalt)
          }
          return response
        })
        return response
      })
  }

  handleLostPasswordClick = event => {
    const {dispatch} = this.props
    const {email} = this.state
    if (event) {
      event.preventDefault()
    }
    if (!validateEmail(email)) {
      dispatch(displayToasterMessage(
        'Entrez correctement votre email dans le champs ci-dessus pour récupérer ' +
          'votre mot de passe.'))
      this.setState({isTryingToResetPassword: true})
      return
    }
    dispatch(askPasswordReset(email)).then(response => {
      if (response) {
        this.setState({passwordResetRequestedEmail: email})
        return response
      }
    })
  }

  isFormValid = () => {
    const {email, isTryingToResetPassword, password} = this.state
    return !!((isTryingToResetPassword || password) && validateEmail(email))
  }

  fastForward = () => {
    const {email, password} = this.state
    if (this.isFormValid()) {
      this.handleLogin()
      return
    }
    this.setState({
      email: email || 'test@example.com',
      // Let's hope it's the right password.
      password: password || 'password',
    })
  }

  render() {
    const {email, isTryingToResetPassword, password, passwordResetRequestedEmail} = this.state
    const {isAskingForPasswordReset, isAuthenticatingEmail,
      isAuthenticatingOther, onLogin} = this.props
    const loginBoxStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    const lostPasswordLinkStyle = {
      color: colors.COOL_GREY,
      display: 'inline-block',
      fontSize: 13,
      marginLeft: 15,
      marginTop: 12,
      textDecoration: 'none',
    }
    const handleSubmit = isTryingToResetPassword ? this.handleLostPasswordClick : this.handleLogin
    return <form style={loginBoxStyle} onSubmit={handleSubmit}>
      <FastForward onForward={this.fastForward} />
      <FormHeader
        title={isTryingToResetPassword ? 'Mot de passe oublié ?' : "S'identifier"}
        question={isTryingToResetPassword ? '' : 'Pas encore de compte ?'}
        linkText="Inscrivez-vous !"
        onClick={this.props.onShowRegistrationFormClick} />

      <SocialLoginButtons onLogin={onLogin} />

      <FormSection title="Identification par mot de passe">
        <IconInput
          shouldFocusOnMount={!email}
          type="email" placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
          applyFunc={email => email.toLocaleLowerCase()}
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          onChange={this.handleChange('email')} />
        {isTryingToResetPassword ? null : <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="password" shouldFocusOnMount={!!email}
          placeholder="Mot de passe" value={password} iconComponent={LockOutlineIcon}
          onChange={this.handleChange('password')}
          style={{marginTop: 10}} />}
      </FormSection>

      {isTryingToResetPassword ? null : <a
        style={{...lostPasswordLinkStyle, cursor: 'pointer'}}
        onClick={this.handleLostPasswordClick}>
        Mot de passe oublié ?
      </a>}
      {passwordResetRequestedEmail ?
        <span style={lostPasswordLinkStyle}>
          Un email a été envoyé à {passwordResetRequestedEmail}
        </span>
        : <Button
          disabled={!this.isFormValid() || isAuthenticatingOther || isAuthenticatingEmail}
          onClick={() => handleSubmit()}
          style={{alignSelf: 'center', marginTop: 30}}
          isNarrow={true}
          isProgressShown={(isAuthenticatingEmail || isAskingForPasswordReset)}
          type="validation">
          {isTryingToResetPassword ? 'Récupérer son mot de passe' : "S'identifier"}
        </Button>}
    </form>
  }
}
const LoginForm = connect(({asyncState: {authMethod, isFetching}}) => ({
  isAskingForPasswordReset: isFetching[RESET_USER_PASSWORD],
  isAuthenticatingEmail:
    isFetching[EMAIL_CHECK] || isFetching[AUTHENTICATE_USER] && authMethod === 'password',
  isAuthenticatingOther: isFetching[AUTHENTICATE_USER] && authMethod !== 'password',
}))(LoginFormBase)


class ResetPasswordFormBase extends React.Component {
  static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isAuthenticating: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    resetToken: PropTypes.string.isRequired,
  }

  state = {
    email: this.props.defaultEmail || '',
    password: '',
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  handleResetPassword = event => {
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!this.isFormValid()) {
      return
    }
    const {email, password} = this.state
    const {dispatch, onLogin, resetToken} = this.props
    dispatch(resetPassword(email, password, resetToken)).then(response => {
      if (response && response.authenticatedUser) {
        onLogin(response.authenticatedUser)
      }
      return response
    })
  }

  isFormValid = () => {
    const {email, password} = this.state
    return !!(password && validateEmail(email))
  }

  render() {
    const {email, password} = this.state
    const {isAuthenticating} = this.props
    const loginBoxStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    return <form style={loginBoxStyle} onSubmit={this.handleResetPassword}>
      <FormHeader title="Changez votre mot de passe" />
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        shouldFocusOnMount={!email}
        type="email" placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
        applyFunc={email => email.toLocaleLowerCase()}
        onChange={this.handleChange('email')} />
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="password" shouldFocusOnMount={!!email}
        placeholder="Nouveau mot de passe" value={password} iconComponent={LockOutlineIcon}
        onChange={this.handleChange('password')}
        style={{marginTop: 10}} />
      <Button
        disabled={!this.isFormValid()}
        onClick={this.handleResetPassword}
        style={{alignSelf: 'center', marginTop: 30}}
        isProgressShown={isAuthenticating}
        isNarrow={true}
        type="validation">
        Changer le mot de passe
      </Button>
    </form>
  }
}
const ResetPasswordForm = connect(({asyncState}) => ({
  isAuthenticating: asyncState.isFetching[EMAIL_CHECK] || asyncState.isFetching[AUTHENTICATE_USER],
}))(ResetPasswordFormBase)


class RegistrationFormBase extends React.Component {
  static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isAuthenticating: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    onShowLoginFormClick: PropTypes.func.isRequired,
  }

  state = {
    email: this.props.defaultEmail || '',
    hasAcceptedTerms: false,
    lastName: '',
    name: '',
    password: '',
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  handleRegister = () => {
    if (!this.isFormValid()) {
      return
    }
    const {email, password, name, lastName} = this.state
    const {dispatch, onLogin, onShowLoginFormClick} = this.props
    return dispatch(registerNewUser(email, password, name, lastName)).then(response => {
      if (!response) {
        return response
      }
      // TODO: Handle this more explicitly after switch to two endpoints.
      // User already exists
      if (!response.authenticatedUser) {
        dispatch(displayToasterMessage(
          'Ce compte existe déjà, merci de vous connecter avec vos identifiants'))
        onShowLoginFormClick()
        return
      }
      onLogin(response.authenticatedUser)
      return response
    })
  }

  isFormValid = () => {
    const {email, hasAcceptedTerms, password, lastName, name} = this.state
    return !!(hasAcceptedTerms && password && lastName && name && validateEmail(email))
  }

  fastForward = () => {
    const {email, password, lastName, name} = this.state
    if (this.isFormValid()) {
      this.handleRegister()
      return
    }
    this.setState({
      email: email || 'test-' + (new Date().getTime()) + '@example.com',
      hasAcceptedTerms: true,
      lastName: lastName || 'Dupont',
      name: name || 'Angèle',
      password: password || 'password',
    })
  }

  render() {
    const {email, hasAcceptedTerms, password, name, lastName} = this.state
    const {isAuthenticating, onLogin} = this.props
    const registrationBoxStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    return <form style={registrationBoxStyle} onSubmit={this.handleRegister}>
      <FastForward onForward={this.fastForward} />
      <FormHeader
        title="Créer un compte"
        question="Déjà un compte ?"
        linkText="Connectez-vous !"
        onClick={this.props.onShowLoginFormClick} />

      <SocialLoginButtons onLogin={onLogin} isNewUser={true} />

      <FormSection title="Inscription par mot de passe">
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          shouldFocusOnMount={true}
          type="text" placeholder="Prénom" value={name} iconComponent={AccountOutlineIcon}
          onChange={this.handleChange('name')} />
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="text" placeholder="Nom" value={lastName} iconComponent={AccountOutlineIcon}
          onChange={this.handleChange('lastName')}
          style={{marginTop: 10}} />
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="email" placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
          applyFunc={email => email.toLocaleLowerCase()}
          onChange={this.handleChange('email')}
          style={{marginTop: 10}} />
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="password"
          placeholder="Créer un mot de passe" value={password} iconComponent={LockOutlineIcon}
          onChange={this.handleChange('password')}
          style={{marginTop: 10}} />
      </FormSection>

      <div style={{fontSize: 12, margin: '10px auto 0', maxWidth: 325}}>
        Nous sommes une association loi 1901 à but non lucratif&nbsp;:
        {' '}{config.productName} est <strong>gratuit</strong> et le restera
        toujours.
      </div>
      <LabeledToggle
        type="checkbox" label={<span>
            J'ai lu et j'accepte les <Link
            to={Routes.TERMS_AND_CONDITIONS_PAGE} target="_blank" rel="noopener noreferrer"
            onClick={event => event.stopPropagation()}>
              conditions générales d'utilisation
          </Link>
        </span>}
        style={{fontSize: 12, marginTop: 10}}
        isSelected={hasAcceptedTerms}
        onClick={() => this.setState({hasAcceptedTerms: !hasAcceptedTerms})} />
      <Button
        disabled={!this.isFormValid()}
        onClick={this.handleRegister}
        style={{alignSelf: 'center', marginTop: 30}}
        isNarrow={true}
        isProgressShown={isAuthenticating}
        type="validation">
        S'inscrire
      </Button>
    </form>
  }
}
const RegistrationForm = connect(({app, asyncState}) => {
  const {loginModal} = app
  const {email} = loginModal && loginModal.defaultValues || {}
  return {
    defaultEmail: email,
    isAuthenticating: asyncState.isFetching[AUTHENTICATE_USER],
  }
})(RegistrationFormBase)


class FormSection extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    title: PropTypes.node.isRequired,
  }

  render() {
    const {children, title} = this.props
    const titleStyle = {
      color: colors.GREYISH_BROWN,
      fontSize: 14,
      margin: '30px 0 15px',
      textAlign: 'center',
    }
    return <React.Fragment>
      <div style={titleStyle}>
        {title}
      </div>
      {children}
    </React.Fragment>
  }
}


class FormHeader extends React.Component {
  static propTypes = {
    linkText: PropTypes.string,
    onClick: PropTypes.func,
    question: PropTypes.string,
    title: PropTypes.string.isRequired,
  }

  render() {
    const {linkText, onClick, question, title} = this.props
    const headlineStyle = {
      color: colors.DARK_TWO,
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.6,
      textAlign: 'center',
    }
    const contentStyle = {
      color: colors.GREYISH_BROWN,
      fontSize: 14,
      lineHeight: 1.4,
      textAlign: 'center',
    }
    const linkStyle = {
      color: colors.BOB_BLUE,
      cursor: 'pointer',
      textDecoration: 'underline',
    }
    return <div style={{marginBottom: 20}}>
      <div style={headlineStyle}>{title}</div>
      {question && onClick && linkStyle && linkText ? <div style={contentStyle}>
        <span>{question} </span>
        <span onClick={onClick} style={linkStyle}>{linkText}</span>
      </div> : null}
    </div>
  }
}


class OAuth2ConnectLogin extends React.Component {
  static propTypes = {
    authorizeEndpoint: PropTypes.string.isRequired,
    authorizeParams: PropTypes.objectOf(PropTypes.string.isRequired),
    children: PropTypes.node,
    clientId: PropTypes.string.isRequired,
    logo: PropTypes.string.isRequired,
    onFailure: PropTypes.func,
    onSuccess: PropTypes.func,
    scopes: PropTypes.arrayOf(PropTypes.string.isRequired),
    style: PropTypes.object,
  }

  componentDidMount() {
    const {onFailure, onSuccess} = this.props
    const {search} = window.location
    if (!search) {
      return
    }
    const {code, error, error_description: errorDescription, state} = parse(search.substr(1))
    if (!state) {
      return
    }
    // TODO(pascal): Cleanup the URL and localStorage so that a refresh does
    // not attempt logging in again.
    const stateContent = localStorage.getItem(this.getLocalStorageKey(state))
    if (!stateContent) {
      return
    }
    const {clientId, nonce} = JSON.parse(stateContent)
    if (clientId !== this.props.clientId) {
      return
    }
    if (!nonce) {
      onFailure(new Error(`Invalid state: "${state}".`))
      return
    }
    if (error || !code) {
      if (/Owner did not authorize/.test(errorDescription)) {
        // User canceled their request so they are aware of what happened.
        onFailure(new Error('Authentification annulée'))
        return
      }
      onFailure(new Error(
        errorDescription || error || "Erreur lors de l'authentification, code manquant"))
      return
    }
    onSuccess({code, nonce})
  }

  getLocalStorageKey(state) {
    return `oauth2.${state}`
  }

  getRandomHash() {
    return (Math.random() * 36).toString(36)
  }

  startSigninFlow = () => {
    const {authorizeEndpoint, authorizeParams, clientId, scopes} = this.props
    const state = this.getRandomHash()
    const nonce = this.getRandomHash()
    const {host, protocol} = window.location
    const redirectUri = `${protocol}//${host}${Routes.ROOT}`
    const url = `${authorizeEndpoint}?${stringify({
      'client_id': clientId,
      nonce,
      'redirect_uri': redirectUri,
      'response_type': 'code',
      state,
      ...(scopes ? {scope: scopes.join(' ')} : {}),
      ...authorizeParams,
    })}`
    localStorage.setItem(this.getLocalStorageKey(state), JSON.stringify({clientId, nonce}))
    window.location = url
  }

  render() {
    const {children, logo, style, ...extraProps} = this.props
    const buttonStyle = {
      padding: '5px 10px',
      ...style,
    }
    const imageStyle = {
      height: 31,
      marginRight: 10,
      verticalAlign: 'middle',
      width: 34,
    }
    return <button
      {..._omit(extraProps,
        ['authorizeEndpoint', 'authorizeParams', 'clientId', 'onFailure', 'onSuccess', 'scopes'])}
      onClick={this.startSigninFlow} style={buttonStyle} type="button">
      <img style={imageStyle} src={logo} alt="Icône Pôle emploi" />
      {children}
    </button>
  }
}


class LoginModalBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isLoginFormShownByDefault: PropTypes.bool,
    isShown: PropTypes.bool,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }),
    resetToken: PropTypes.string,
  }

  state = {
    isShown: false,
    isShownAsFullPage: false,
  }

  static getDerivedStateFromProps(nextProps, {isShown: wasShown}) {
    const {isLoginFormShownByDefault, isShown, resetToken} = nextProps
    const wantShown = isShown || !!resetToken
    if (wantShown === wasShown) {
      return null
    }
    const newState = {
      isShown: wantShown,
    }
    if (wantShown) {
      newState.isShownAsFullPage = !isMobileVersion && !resetToken && !isLoginFormShownByDefault
    }
    return newState
  }

  close = hasCanceledLogin => {
    const {dispatch, history, location} = this.props
    dispatch(closeLoginModal(hasCanceledLogin))
    if (!hasCanceledLogin) {
      if (location.pathname !== Routes.ROOT) {
        history.push(Routes.ROOT)
      }
    }
  }

  renderIntro(style) {
    const containerStyle = {
      minHeight: '100vh',
      position: 'relative',
      zIndex: 0,
      ...style,
    }
    const coverAll = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    const coverImageStyle = {
      ...coverAll,
      backgroundImage: `url(${chooseImageVersion(signupCoverImage, isMobileVersion)})`,
      backgroundPosition: 'center, center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      zIndex: -2,
    }
    const contentStyle = {
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 29,
      justifyContent: 'center',
      lineHeight: '38px',
      minHeight: '100vh',
      padding: 60,
    }
    const titleStyle = {
      fontSize: 60,
      fontWeight: 'bold',
      lineHeight: 1,
      textShadow: `0 2px 6px ${colorToAlpha(colors.BOB_BLUE_HOVER, .5)}`,
    }
    const quoteStyle = {
      fontSize: 128,
      opacity: .3,
      position: 'absolute',
      right: '100%',
    }

    return <div style={containerStyle}>
      <div style={{...coverAll, backgroundColor: colors.BOB_BLUE, opacity: .9, zIndex: -1}} />
      <div style={coverImageStyle} />
      <div style={contentStyle}>
        <div style={titleStyle}>
          Commençons à travailler ensemble&nbsp;!
        </div>

        <div style={{fontStyle: 'italic', marginTop: 60, maxWidth: 550, position: 'relative'}}>
          <div style={quoteStyle}>“</div>
          Nous allons vous poser quelques questions afin de mieux vous
          connaître et vous proposer les conseils que nous pensons être les
          plus adaptés.

          <br /><br />

          Certains vous ouvriront de nouvelles pistes de réflexion, d'autres
          peut-être moins. Faites-nous vos retours&nbsp;: {config.productName} s'améliore grâce
          à vous&nbsp;!
        </div>

        <div style={{fontSize: 20, marginTop: 40}}>
          - L'équipe de {config.productName}
        </div>
      </div>
    </div>
  }

  render() {
    const {resetToken} = this.props
    const {isShownAsFullPage} = this.state

    const containerStyle = isShownAsFullPage ? {
      alignItems: 'center',
      display: 'flex',
      transition: 'none',
      width: '100vw',
    } : {
      borderRadius: 5,
      width: isMobileVersion ? 'initial' : 400,
    }
    const closeButtonStyle = {
      ':hover': {
        opacity: .9,
      },
      boxShadow: 'initial',
      opacity: .6,
      right: 50,
      top: 50,
      transform: 'initial',
    }

    return <Modal
      isShown={this.state.isShown || !!resetToken} style={containerStyle}
      onClose={(resetToken || isShownAsFullPage) ? null : () => this.close(true)}>
      {isShownAsFullPage ? this.renderIntro({flex: 1}) : null}
      {isShownAsFullPage ?
        <ModalCloseButton onClick={() => this.close(true)} style={closeButtonStyle} /> : null}
      <LoginMethods onFinish={this.close} />
    </Modal>
  }
}
const LoginModal = connect(({app: {loginModal}}) => {
  const {isReturningUser, resetToken} = loginModal && loginModal.defaultValues || {}
  return {
    isLoginFormShownByDefault: !!isReturningUser,
    // TODO(cyrille): Clean this up, since modal is never rendered if !loginModal.
    isShown: !!loginModal,
    resetToken,
  }
})(withRouter(LoginModalBase))


class LoginMethodsBase extends React.Component {
  static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isLoginFormShownByDefault: PropTypes.bool,
    onFinish: PropTypes.func,
    onLogin: PropTypes.func,
    resetToken: PropTypes.string,
  }

  state = {
    isLoginFormShown: this.props.isLoginFormShownByDefault,
  }

  handleActualLogin = user => {
    const {onFinish, onLogin} = this.props
    onLogin && onLogin(user)
    onFinish && onFinish(false)
  }


  handleLogin = (email, password, hashSalt) => {
    const {dispatch} = this.props
    dispatch(loginUser(email, password, hashSalt)).then(response => {
      if (response && response.authenticatedUser) {
        this.handleActualLogin(response.authenticatedUser)
        // TODO: Take care of the else case when the authentication was
        // not successful but we got back some new salt. (response.hashSalt)
      }
      return response
    })
  }

  render() {
    const {defaultEmail, resetToken} = this.props
    const {isLoginFormShown} = this.state
    const actionBoxStyle = {
      alignItems: 'center',
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      padding: '30px 20px',
    }
    let form
    if (resetToken) {
      form = <ResetPasswordForm
        defaultEmail={defaultEmail} onLogin={this.handleActualLogin} resetToken={resetToken} />
    } else if (isLoginFormShown) {
      form = <LoginForm
        onLogin={this.handleActualLogin} defaultEmail={defaultEmail}
        onShowRegistrationFormClick={() => this.setState({isLoginFormShown: false})} />
    } else {
      form = <RegistrationForm
        onLogin={this.handleActualLogin}
        onShowLoginFormClick={() => this.setState({isLoginFormShown: true})} />
    }
    // TODO(pascal): Simplify and cleanup styling here.
    return <div style={{flex: 1, ...Styles.CENTERED_COLUMN}}>
      <div style={actionBoxStyle}>
        {form}
      </div>
    </div>
  }
}
const LoginMethods = connect(({app: {loginModal}}) => {
  const {email, isReturningUser, resetToken} = loginModal && loginModal.defaultValues || {}
  return {
    defaultEmail: email,
    isLoginFormShownByDefault: !!isReturningUser,
    resetToken,
  }
})(LoginMethodsBase)


class SocialLoginButtonsBase extends React.Component {
  static propTypes = {
    authMethod: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isAuthenticating: PropTypes.bool,
    isNewUser: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    style: PropTypes.object,
  }

  handleAuthResponse = response => {
    if (!response) {
      return response
    }
    const {dispatch, isNewUser: wantsNewUser, onLogin} = this.props
    const {authenticatedUser, isNewUser} = response
    if (isNewUser && !wantsNewUser) {
      dispatch(displayToasterMessage("Création d'un nouveau compte"))
    } else if (!isNewUser && wantsNewUser) {
      dispatch(displayToasterMessage('Connexion avec le compte existant'))
    }
    // TODO(pascal): Make sure we go to /confidentialite page on first registration.
    onLogin(authenticatedUser)
  }

  handleFacebookLogin = facebookAuth => {
    // The facebookAuth object contains:
    //  - the email address: email
    //  - the facebook user ID: userID
    //  - the full name: name
    //  - the URL of a profile picture: picture.data.url
    const email = facebookAuth && facebookAuth.email
    if (email) {
      this.props.dispatch(facebookAuthenticateUser(facebookAuth)).then(this.handleAuthResponse)
    }
  }

  handleGoogleLogin = googleAuth => {
    // The googleAuth object contains the profile in getBasicProfile()
    //  - the Google ID: getId()
    //  - the email address: getEmail()
    //  - the first name: getGivenName()
    //  - the last name: getFamilyName()
    //  - the full name: getName()
    //  - the URL of a profile picture: getImageUrl()
    const email = googleAuth && googleAuth.getBasicProfile().getEmail()
    if (email) {
      this.props.dispatch(googleAuthenticateUser(googleAuth)).then(this.handleAuthResponse)
    }
  }

  handleGoogleFailure = ({details}) => {
    const {dispatch} = this.props
    dispatch(displayToasterMessage(details))
  }

  handleConnectFailure = error => {
    const {dispatch} = this.props
    dispatch(displayToasterMessage(error.message))
  }

  handlePEConnectLogin = ({code, nonce}) => {
    this.props.dispatch(peConnectAuthenticateUser(code, nonce)).then(this.handleAuthResponse)
  }

  handleLinkedinLogin = ({code}) => {
    this.props.dispatch(linkedInAuthenticateUser(code)).then(this.handleAuthResponse)
  }

  render() {
    const {authMethod, isAuthenticating, style} = this.props
    const socialLoginBox = {
      ...style,
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
    }
    const googleIconStyle = {
      height: 24,
      marginRight: 10,
      verticalAlign: 'middle',
      width: 34,
    }
    const circularProgressStyle = {
      color: '#fff',
      display: 'inline-block',
      textAlign: 'center',
      verticalAlign: 'middle',
      width: 170,
    }
    return <div style={socialLoginBox}>
      <FacebookLogin
        appId={config.facebookSSOAppId} language="fr" disabled={isAuthenticating}
        callback={this.handleFacebookLogin}
        fields="email,name,picture,gender,birthday"
        size="small" icon="fa-facebook"
        textButton={isAuthenticating && authMethod === 'facebook' ?
          <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
          <React.Fragment>Se connecter avec Facebook</React.Fragment>}
        cssClass="login facebook-login" />
      <GoogleLogin
        clientId={config.googleSSOClientId} offline={false} disabled={isAuthenticating}
        onSuccess={this.handleGoogleLogin}
        onFailure={this.handleGoogleFailure}
        render={({onClick}) => <button className="login google-login" onClick={onClick}>
          <GoogleIcon style={googleIconStyle} />{isAuthenticating && authMethod === 'google' ?
            <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
            <React.Fragment>Se connecter avec Google</React.Fragment>}
        </button>} />
      <OAuth2ConnectLogin
        authorizeEndpoint="https://authentification-candidat.pole-emploi.fr/connexion/oauth2/authorize"
        scopes={['api_peconnect-individuv1', 'profile', 'email',
          'coordonnees', 'api_peconnect-coordonneesv1', 'openid',
          // TODO(cyrille): Add 'pfccompetences', 'api_peconnect-competencesv2' once we have
          // upgraded to competences v2.
        ]}
        authorizeParams={{realm: '/individu'}} disabled={isAuthenticating}
        clientId={config.emploiStoreClientId}
        className="login pe-connect-login"
        logo={peConnectIcon}
        onSuccess={this.handlePEConnectLogin}
        onFailure={this.handleConnectFailure}>
        {isAuthenticating && authMethod === 'peConnect' ?
          <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
          <React.Fragment>Se connecter avec pôle emploi</React.Fragment>}
      </OAuth2ConnectLogin>
      <OAuth2ConnectLogin
        clientId={config.linkedInClientId} disabled={isAuthenticating}
        authorizeEndpoint="https://www.linkedin.com/oauth/v2/authorization"
        onSuccess={this.handleLinkedinLogin}
        onFailure={this.handleConnectFailure}
        logo={linkedInIcon} style={{marginBottom: 0}}
        className="login linkedin-login">
        {isAuthenticating && authMethod === 'linkedIn' ?
          <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
          <React.Fragment>Se connecter avec LinkedIn</React.Fragment>}
      </OAuth2ConnectLogin>
    </div>
  }
}
const SocialLoginButtons = connect(({asyncState: {authMethod, isFetching}}) => ({
  authMethod,
  isAuthenticating: isFetching[EMAIL_CHECK] || isFetching[AUTHENTICATE_USER],
}))(SocialLoginButtonsBase)


class LoginButtonBase extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    dispatch: PropTypes.func.isRequired,
    email: PropTypes.string,
    isLoggedIn: PropTypes.bool,
    isSignUpButton: PropTypes.bool,
    style: PropTypes.object,
    visualElement: PropTypes.string,
  }

  state = {
    isClicked: false,
  }

  handleClick = () => {
    const {email, isLoggedIn, isSignUpButton, dispatch, visualElement} = this.props
    if (isLoggedIn) {
      this.setState({isClicked: true})
      return
    }
    if (isSignUpButton) {
      dispatch(openRegistrationModal({email}, visualElement))
    } else {
      dispatch(openLoginModal({email}, visualElement))
    }
  }

  render() {
    if (this.state.isClicked) {
      return <Redirect to={Routes.PROJECT_PAGE} push={true} />
    }
    const {children} = this.props
    const extraProps = _omit(this.props, [
      'children', 'dispatch', 'email', 'isLoggedIn', 'isSignUpButton', 'visualElement',
    ])
    return <Button type="deletion" onClick={this.handleClick} {...extraProps}>
      {children}
    </Button>
  }
}
const LoginButton = connect(({user}) => ({
  isLoggedIn: !!user.userId,
}))(LoginButtonBase)


export {LoginModal, LoginMethods, LoginButton}

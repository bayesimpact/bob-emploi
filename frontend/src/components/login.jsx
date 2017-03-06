import React from 'react'
import {connect} from 'react-redux'
import {Link, browserHistory} from 'react-router'

import FacebookLogin from 'react-facebook-login'
import GoogleLogin from 'react-google-login'
import config from 'config'

import {ShortKey} from 'components/shortkey'
import {validateEmail} from 'store/validations'
import {facebookAuthenticateUser, googleAuthenticateUser, emailCheck,
        registerNewUser, loginUser, displayToasterMessage, resetPassword,
        askPasswordReset, openLoginModal, closeLoginModalAction,
        AUTHENTICATE_USER, EMAIL_CHECK, RESET_USER_PASSWORD} from 'store/actions'
import {Colors, Icon, IconInput, LabeledToggle, RoundButton, Styles} from 'components/theme'
import {upperFirstLetter} from 'store/french'
import {Modal} from 'components/modal'
import {Routes} from 'components/url'


class LoginFormBase extends React.Component {
  static propTypes = {
    defaultEmail: React.PropTypes.string,
    dispatch: React.PropTypes.func.isRequired,
    isAskingForPasswordReset: React.PropTypes.bool,
    isAuthenticating: React.PropTypes.bool,
    onLogin: React.PropTypes.func.isRequired,
    onShowRegistrationFormClick: React.PropTypes.func.isRequired,
  }

  state = {
    email: '',
    hashSalt: '',
    isTryingToResetPassword: false,
    password: '',
    passwordResetRequestedEmail: null,
  }

  componentWillMount() {
    this.setState({email: this.props.defaultEmail || ''})
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
        this.setState({hashSalt: response.hashSalt})
        return response
      }).
      then(response => {
        if (response.isNewUser) {
          // TODO: Emphasize to registration form if response.isNewUser
          dispatch(displayToasterMessage("L'utilisateur n'existe pas."))
          return
        }
        const {email, password, hashSalt} = this.state
        this.props.onLogin(email, password, hashSalt)
        return response
      })
  }

  handleLostPasswordClick = event => {
    const {dispatch} = this.props
    const {email} = this.state
    event.preventDefault()
    if (!validateEmail(email)) {
      dispatch(displayToasterMessage(
          'Entrez correctement votre email dans le champs ci-dessus pour récupérer ' +
          'votre mot de passe'))
      this.setState({isTryingToResetPassword: true})
      return
    }
    dispatch(askPasswordReset(email)).then(response => {
      this.setState({passwordResetRequestedEmail: email})
      return response
    })
  }

  isFormValid = () => {
    const {email, isTryingToResetPassword, password} = this.state
    return !!((isTryingToResetPassword || password) && validateEmail(email))
  }

  fastForward = () => {
    // TODO: Fix fastforward triggering when a text input is selected on Mac in Chrome.
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
    const {isAskingForPasswordReset, isAuthenticating} = this.props
    const loginBoxStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    const lostPasswordLinkStyle = {
      color: '#9596a0',
      display: 'inline-block',
      fontSize: 13,
      marginLeft: 15,
      marginTop: 12,
      textDecoration: 'none',
    }
    return <form style={loginBoxStyle} onSubmit={this.handleLogin}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.fastForward} />
      <FormHeader
          title={isTryingToResetPassword ? 'Mot de passe oublié ?' : 'Se connecter'}
          question={isTryingToResetPassword ? '' : 'Pas encore de compte ?'}
          linkText="Inscrivez-vous !"
          onClick={this.props.onShowRegistrationFormClick} />
      <IconInput
          autofocus={!email}
          type="email" placeholder="Email" value={email} iconName="email-outline"
          applyFunc={email => email.toLocaleLowerCase()}
          onChange={this.handleChange('email')} />
      {isTryingToResetPassword ? null : <IconInput
          type="password" autofocus={!!email}
          placeholder="Mot de passe" value={password} iconName="lock-outline"
          onChange={this.handleChange('password')}
          style={{marginTop: 10}} />}
      {isTryingToResetPassword ? null : <a
          style={{...lostPasswordLinkStyle, cursor: 'pointer'}}
          onClick={this.handleLostPasswordClick}>
        Mot de passe oublié ?
      </a>}
      {passwordResetRequestedEmail ?
        <span style={lostPasswordLinkStyle}>
          Un email a été envoyé à {passwordResetRequestedEmail}
        </span>
      :
      <RoundButton
          disabled={!this.isFormValid()}
          onClick={isTryingToResetPassword ? this.handleLostPasswordClick : this.handleLogin}
          style={{alignSelf: 'center', marginTop: 30}}
          isNarrow={true}
          isProgressShown={(isAuthenticating || isAskingForPasswordReset)}
          type="validation">
        {isTryingToResetPassword ? 'Récupérer son mot de passe' : 'Se connecter'}
      </RoundButton>}
    </form>
  }
}
const LoginForm = connect(({asyncState}) => ({
  isAskingForPasswordReset: asyncState.isFetching[RESET_USER_PASSWORD],
  isAuthenticating: asyncState.isFetching[EMAIL_CHECK] || asyncState.isFetching[AUTHENTICATE_USER],
}))(LoginFormBase)


class ResetPasswordFormBase extends React.Component {
  static propTypes = {
    defaultEmail: React.PropTypes.string,
    isAuthenticating: React.PropTypes.bool,
    onResetPassword: React.PropTypes.func.isRequired,
  }

  componentWillMount() {
    this.setState({
      email: this.props.defaultEmail || '',
      password: '',
    })
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  handleResetPassword = event => {
    const {onResetPassword} = this.props
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!this.isFormValid()) {
      return
    }
    const {email, password} = this.state
    onResetPassword(email, password)
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
          autofocus={!email}
          type="email" placeholder="Email" value={email} iconName="email-outline"
          applyFunc={email => email.toLocaleLowerCase()}
          onChange={this.handleChange('email')} />
      <IconInput
          type="password" autofocus={!!email}
          placeholder="Nouveau mot de passe" value={password} iconName="lock-outline"
          onChange={this.handleChange('password')}
          style={{marginTop: 10}} />
      <RoundButton
          disabled={!this.isFormValid()}
          onClick={this.handleResetPassword}
          style={{alignSelf: 'center', marginTop: 30}}
          isProgressShown={isAuthenticating}
          isNarrow={true}
          type="validation">
        Changer le mot de passe
      </RoundButton>
    </form>
  }
}
const ResetPasswordForm = connect(({asyncState}) => ({
  isAuthenticating: asyncState.isFetching[EMAIL_CHECK] || asyncState.isFetching[AUTHENTICATE_USER],
}))(ResetPasswordFormBase)


class RegistrationFormBase extends React.Component {
  static propTypes = {
    isAuthenticating: React.PropTypes.bool,
    onRegister: React.PropTypes.func.isRequired,
    onShowLoginFormClick: React.PropTypes.func.isRequired,
  }

  state = {
    email: '',
    hasAcceptedTerms: false,
    lastName: '',
    name: '',
    password: '',
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  handleRegister = event => {
    const {email, password, name, lastName} = this.state
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!this.isFormValid()) {
      return
    }
    this.props.onRegister(email, password, name, lastName).then(() => {
      this.setState({
        email: '',
        hasAcceptedTerms: false,
        lastName: '',
        name: '',
        password: '',
      })
    })
  }

  isFormValid = () => {
    const {email, hasAcceptedTerms, password, lastName, name} = this.state
    return !!(hasAcceptedTerms && password && lastName && name && validateEmail(email))
  }

  fastForward = () => {
    // TODO: Fix fastforward triggering when a text input is selected on Mac in Chrome.
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
    const {isAuthenticating} = this.props
    const registrationBoxStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    return <form style={registrationBoxStyle} onSubmit={this.handleRegister}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.fastForward} />
      <FormHeader
          title="Créer un compte"
          question="Déjà un compte ?"
          linkText="Connectez-vous !"
          onClick={this.props.onShowLoginFormClick} />
      <IconInput
          autofocus={true}
          type="text" placeholder="Prénom" value={name} iconName="account-outline"
          onChange={this.handleChange('name')} />
      <IconInput
          type="text" placeholder="Nom" value={lastName} iconName="account-outline"
          onChange={this.handleChange('lastName')}
          style={{marginTop: 10}} />
      <IconInput
          type="email" placeholder="Email" value={email} iconName="email-outline"
          applyFunc={email => email.toLocaleLowerCase()}
          onChange={this.handleChange('email')}
          style={{marginTop: 10}} />
      <IconInput
          type="password"
          placeholder="Créer un mot de passe" value={password} iconName="lock-outline"
          onChange={this.handleChange('password')}
          style={{marginTop: 10}} />
      <LabeledToggle
          type="checkbox" label={<span>
            J'ai lu et j'accepte les <Link
                to={Routes.TERMS_AND_CONDITIONS_PAGE} target="_blank"
                onClick={event => event.stopPropagation()}>
              conditions générales d'utilisation
            </Link>
          </span>}
          style={{fontSize: 12, marginTop: 10}}
          isSelected={hasAcceptedTerms}
          onClick={() => this.setState({hasAcceptedTerms: !hasAcceptedTerms})} />
      <RoundButton
          disabled={!this.isFormValid()}
          onClick={this.handleRegister}
          style={{alignSelf: 'center', marginTop: 30}}
          isNarrow={true}
          isProgressShown={isAuthenticating}
          type="validation">
        S'inscrire
      </RoundButton>
    </form>
  }
}
const RegistrationForm = connect(({asyncState}) => ({
  isAuthenticating: asyncState.isFetching[AUTHENTICATE_USER],
}))(RegistrationFormBase)


class FormHeader extends React.Component {
  static propTypes = {
    linkText: React.PropTypes.string,
    onClick: React.PropTypes.func,
    question: React.PropTypes.string,
    title: React.PropTypes.string.isRequired,
  }

  render() {
    const {linkText, onClick, question, title} = this.props
    const headlineStyle = {
      color: '#2c3449',
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.6,
      textAlign: 'center',
    }
    const contentStyle = {
      color: '#575757',
      fontSize: 14,
      lineHeight: 1.4,
      textAlign: 'center',
    }
    const linkStyle = {
      color: '#58bbfb',
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


class LoginModalBase extends React.Component {
  static propTypes = {
    defaultEmail: React.PropTypes.string,
    defaultIsLoginFormShown: React.PropTypes.bool,
    dispatch: React.PropTypes.func.isRequired,
    isShown: React.PropTypes.bool,
    onLogin: React.PropTypes.func,
    resetToken: React.PropTypes.string,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool.isRequired,
  }

  state = {
    isLoginFormShown: false,
    isShown: false,
  }

  componentWillMount() {
    const {defaultIsLoginFormShown, isShown} = this.props
    this.componentWillReceiveProps({defaultIsLoginFormShown, isShown})
  }

  componentWillReceiveProps(nextProps) {
    const wantShown = nextProps.isShown || !!nextProps.resetToken
    if (wantShown === this.state.isShown) {
      return
    }
    this.setState({isShown: wantShown})
    if (wantShown) {
      this.setState({isLoginFormShown: nextProps.defaultIsLoginFormShown})
    }
  }

  handleActualLogin = user => {
    const {onLogin} = this.props
    onLogin && onLogin(user)
    this.close()
  }

  close = () => {
    this.props.dispatch(closeLoginModalAction)
  }

  handleFacebookLogin = facebookAuth => {
    const {dispatch} = this.props
    // The facebookAuth object contains:
    //  - the email address: email
    //  - the facebook user ID: userID
    //  - the full name: name
    //  - the URL of a profile picture: picture.data.url
    const email = facebookAuth && facebookAuth.email
    if (email) {
      dispatch(facebookAuthenticateUser(facebookAuth)).then(response => {
        this.handleActualLogin(response.authenticatedUser)
        return response
      })
    }
  }

  handleGoogleLogin = googleAuth => {
    const {dispatch} = this.props
    // The googleAuth object contains the profile in getBasicProfile()
    //  - the Google ID: getId()
    //  - the email address: getEmail()
    //  - the first name: getGivenName()
    //  - the last name: getFamilyName()
    //  - the full name: getName()
    //  - the URL of a profile picture: getImageUrl()
    const email = googleAuth && googleAuth.getBasicProfile().getEmail()
    if (email) {
      dispatch(googleAuthenticateUser(googleAuth)).then(response => {
        this.handleActualLogin(response.authenticatedUser)
        return response
      })
    }
  }

  // TODO: Use different API endpoints for login and registration.
  handleRegister = (email, password, name, lastName) => {
    const {dispatch} = this.props
    name = upperFirstLetter(name.trim())
    lastName = upperFirstLetter(lastName.trim())
    return dispatch(registerNewUser(email.trim(), password, name, lastName)).then(response => {
      // TODO: Handle this more explicitly after switch to two endpoints.
      // User already exists
      if (!response.authenticatedUser) {
        dispatch(displayToasterMessage(
          'Ce compte existe déjà, merci de vous connecter avec vos identifiants'))
        this.setState({isLoginFormShown: true})
        return
      }
      this.handleActualLogin(response.authenticatedUser)
      return response
    })
  }

  handleLogin = (email, password, hashSalt) => {
    const {dispatch} = this.props
    dispatch(loginUser(email.trim(), password, hashSalt)).then(response => {
      if (response.authenticatedUser) {
        this.handleActualLogin(response.authenticatedUser)
        // TODO: Take care of the else case when the authentication was
        // not successful but we got back some new salt. (response.hashSalt)
      }
      return response
    })
  }

  handleResetPassword = (email, password) => {
    const {dispatch, resetToken} = this.props
    dispatch(resetPassword(email.trim(), password, resetToken)).then(response => {
      if (response.authenticatedUser) {
        this.handleActualLogin(response.authenticatedUser)
      }
      return response
    })
  }

  render() {
    const {defaultEmail, resetToken} = this.props
    const {isMobileVersion} = this.context
    const {isLoginFormShown} = this.state
    const actionBoxStyle = {
      alignItems: 'center',
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      padding: isMobileVersion ? '30px 20px' : '30px 60px',
    }
    const socialLoginBox = {
      ...actionBoxStyle,
      backgroundColor: Colors.BACKGROUND_GREY,
      fontSize: 15,
    }
    const containerStyle = {
      width: isMobileVersion ? 'inherit' : 400,
    }
    const socialLoginPrefix = isLoginFormShown ? 'Connexion' : 'Inscription'
    let form
    if (resetToken) {
      form = <ResetPasswordForm
          defaultEmail={defaultEmail} onResetPassword={this.handleResetPassword} />
    } else if (isLoginFormShown) {
      form = <LoginForm
          onLogin={this.handleLogin} defaultEmail={defaultEmail}
          onShowRegistrationFormClick={() => this.setState({isLoginFormShown: false})} />
    } else {
      form = <RegistrationForm
          onRegister={this.handleRegister}
          onShowLoginFormClick={() => this.setState({isLoginFormShown: true})} />
    }
    return <Modal
        isShown={this.state.isShown || !!resetToken} style={containerStyle}
        onClose={resetToken ? null : this.close}>
      <div style={Styles.CENTERED_COLUMN}>
        <div style={actionBoxStyle}>
          {form}
        </div>
        {resetToken ? null : <div style={socialLoginBox}>
          <FacebookLogin
              appId={config.facebookSSOAppId} language="fr"
              callback={this.handleFacebookLogin}
              fields="email,name,picture,gender,birthday"
              size="small" icon="fa-facebook"
              textButton={`${socialLoginPrefix} avec Facebook`}
              cssClass="login facebook-login"
              style={{borderRadius: 100}} />
          <GoogleLogin
              clientId={config.googleSSOClientId} offline={false}
              callback={this.handleGoogleLogin}
              cssClass="login google-login">
            <Icon name="google" /> {`${socialLoginPrefix} avec Google`}
          </GoogleLogin>
        </div>}
      </div>
    </Modal>
  }
}
const LoginModal = connect(({app}) => {
  const {loginModal} = app
  const {email, isReturningUser, resetToken} = loginModal && loginModal.defaultValues || {}
  return {
    defaultEmail: email,
    defaultIsLoginFormShown: !!isReturningUser,
    isShown: !!loginModal,
    resetToken,
  }
})(LoginModalBase)


class LoginButtonBase extends React.Component {
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    dispatch: React.PropTypes.func.isRequired,
    isLoggedIn: React.PropTypes.bool,
    isSignUpButton: React.PropTypes.bool,
    style: React.PropTypes.object,
    visualElement: React.PropTypes.string,
  }

  handleClick = () => {
    const {isLoggedIn, isSignUpButton, dispatch, visualElement} = this.props
    if (isLoggedIn) {
      browserHistory.push(Routes.PROJECT_PAGE)
      return
    }
    dispatch(openLoginModal({isReturningUser: !isSignUpButton}, visualElement))
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {children, dispatch, isLoggedIn, isSignUpButton, visualElement,
           ...extraProps} = this.props
    return <RoundButton type="deletion" onClick={this.handleClick} {...extraProps}>
      {children}
    </RoundButton>
  }
}
const LoginButton = connect(({user}) => ({
  isLoggedIn: !!user.userId,
}))(LoginButtonBase)


export {LoginModal, LoginButton}
